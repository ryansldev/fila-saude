import { describe, expect, it } from "vitest";
import { estimate, turnLostNotices } from "../src/estimate.ts";
import { inManualMode, OUTAGE_SILENCE_MS, SWEEP_GAP_MS, trackOutage } from "../src/outage.ts";
import { checkIn, lateness, type SessionDay } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { alreadyNotified, dayWith, freeze } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);
const AUTO = { manualMode: false };

const apply = (r: Result<SessionDay>): SessionDay => {
  if (!r.ok) throw new Error(r.error);
  return freeze(r.state);
};
/** O último sinal da unidade (TV e estações) em `last`; o servidor no ar desde bem antes. */
const signal = (last: number | null, serverStartedAt = 0) => ({ lastSignalAt: last, serverStartedAt });
const track = (day: SessionDay, now: number, last: number | null) => freeze(trackOutage(day, now, signal(last)));
/** A unidade já deu sinal de vida nesta sessão, em `at`. */
const alive = (day: SessionDay, at: number) => track(day, at, at);

describe("PV5 (AD-076): o sistema percebe a queda da unidade (RN-SES-05)", () => {
  it("sem sinal da TV e das estações por mais de 2 min: abre a queda desde o último sinal e entra em modo manual", () => {
    let d = track(dayWith(["ana"]), T, T);
    expect(inManualMode(d)).toBe(false);
    d = track(d, T + OUTAGE_SILENCE_MS, T); // exatamente 2 min: ainda não
    expect(inManualMode(d)).toBe(false);
    d = track(d, T + 3 * MIN, T);
    expect(d.outages).toEqual([{ start: T, end: null }]);
    expect(inManualMode(d)).toBe(true);
    d = track(d, T + 4 * MIN, T); // continua a mesma queda
    expect(d.outages).toEqual([{ start: T, end: null }]);
  });

  it("o sinal volta: fecha a queda e sai do modo manual", () => {
    let d = track(alive(dayWith(["ana"]), T), T + 3 * MIN, T);
    d = track(d, T + 20 * MIN, T + 19 * MIN);
    expect(d.outages).toEqual([{ start: T, end: T + 20 * MIN }]);
    expect(inManualMode(d)).toBe(false);
  });

  it("sem estação aberta não há o que perceber (ninguém chamando)", () => {
    const base = dayWith(["ana"]);
    const closed = freeze({ ...base, stations: base.stations.map((e) => ({ ...e, open: false })) });
    expect(track(alive(closed, T), T + 3 * MIN, T).outages ?? []).toEqual([]);
  });

  it("sem sinal desde a abertura da sessão: a unidade ainda não começou, não é queda", () => {
    expect(track(dayWith(["ana"]), T, null).outages ?? []).toEqual([]);
    expect(track(dayWith(["ana"]), T + 30 * MIN, T - 60 * MIN).outages ?? []).toEqual([]);
    expect(inManualMode(track(dayWith(["ana"]), T + 30 * MIN, null))).toBe(false);
  });

  it("servidor fora do ar por mais de 3 min (reiniciou depois do último giro): queda do último giro até a volta", () => {
    const d = alive(dayWith(["ana"]), T);
    const back = T + 20 * MIN;
    const after = freeze(trackOutage(d, back + MIN, signal(back + MIN, back)));
    expect(after.outages).toEqual([{ start: T, end: back }]);
    // Reinício rápido (até 3 min): não é queda.
    const quick = freeze(trackOutage(d, T + 3 * MIN, signal(T + 3 * MIN, T + SWEEP_GAP_MS)));
    expect(quick.outages ?? []).toEqual([]);
  });

  it("giro lento com o servidor no ar não é queda", () => {
    const d = alive(dayWith(["ana"]), T);
    expect(track(d, T + 10 * MIN, T + 10 * MIN).outages ?? []).toEqual([]);
  });

  it("primeiro giro depois de reiniciar não abre queda da unidade: as estações ainda não voltaram a dar sinal", () => {
    const d = alive(dayWith(["ana"]), T);
    const first = freeze(trackOutage(d, T + 2 * MIN + 30_000, signal(T, T + 2 * MIN)));
    expect(inManualMode(first)).toBe(false);
    // No giro seguinte, ainda sem sinal: agora é queda da unidade.
    const next = freeze(trackOutage(first, T + 3 * MIN + 30_000, signal(T, T + 2 * MIN)));
    expect(next.outages).toEqual([{ start: T, end: null }]);
  });

  it("sessão que não está aberta não muda", () => {
    const d = freeze({ ...alive(dayWith(["ana"]), T), state: "closed" as const });
    expect(trackOutage(d, T + 30 * MIN, signal(T))).toBe(d);
  });
});

describe("PV5: o relógio do prazo para durante a queda percebida", () => {
  const notified = () => alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30);

  it("queda aberta: ainda no prazo, sem 'perdeu a vez'", () => {
    const d = track(alive(notified(), T + 20 * MIN), T + 23 * MIN, T + 20 * MIN); // sem sinal desde 10:20
    expect(lateness(d, d.items[0] as never, T + 35 * MIN)).toBe("late_in_contingency");
    expect(turnLostNotices(d, T + 35 * MIN, { manualMode: inManualMode(d) }).events).toEqual([]);
  });

  it("queda fechada das 10:20 às 10:40: o prazo vai a 10:50", () => {
    let d = track(alive(notified(), T + 20 * MIN), T + 23 * MIN, T + 20 * MIN);
    d = track(d, T + 40 * MIN, T + 40 * MIN);
    const ana = (day: SessionDay) => day.items.find((i) => i.id === "ana");
    expect(ana(apply(checkIn(d, { itemId: "ana" }, T + 49 * MIN)))?.number).toBe(1);
    expect(ana(apply(checkIn(d, { itemId: "ana" }, T + 50 * MIN)))?.number).toBe(3);
    expect(turnLostNotices(d, T + 49 * MIN, AUTO).events).toEqual([]);
    expect(turnLostNotices(d, T + 50 * MIN, AUTO).events).toHaveLength(1);
  });

  it("em modo manual a estimativa some (o app manda procurar a recepção)", () => {
    const d = track(alive(notified(), T + 20 * MIN), T + 23 * MIN, T + 20 * MIN);
    expect(estimate(d, "bruno", T + 23 * MIN, { manualMode: inManualMode(d) })).toEqual({ kind: "manual_mode" });
  });
});
