import { describe, expect, it } from "vitest";
import { estimate, turnLostNotices } from "../src/estimate.ts";
import { inManualMode, NO_TV_SILENCE_MS, OUTAGE_SILENCE_MS, SWEEP_GAP_MS, trackOutage } from "../src/outage.ts";
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
/** Unidade com TV: o último sinal da TV em `last`; o servidor no ar desde bem antes. */
const signal = (last: number | null, serverStartedAt = 0) => ({
  hasTv: true,
  tvSignalAt: last,
  stationSignalAt: null,
  serverStartedAt,
});
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
    // Até o primeiro giro depois da volta: o servidor subiu, mas ninguém olhava a unidade.
    expect(after.outages).toEqual([{ start: T, end: back + MIN }]);
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

  it("com TV, só a TV conta: estação com sinal não segura a unidade no ar, nem estação calada a derruba", () => {
    const tv = (tvAt: number | null, stationAt: number | null) => ({
      hasTv: true,
      tvSignalAt: tvAt,
      stationSignalAt: stationAt,
      serverStartedAt: 0,
    });
    const d = alive(dayWith(["ana"]), T);
    expect(trackOutage(d, T + 3 * MIN, tv(T, T + 3 * MIN)).outages).toEqual([{ start: T, end: null }]);
    expect(trackOutage(d, T + 3 * MIN, tv(T + 3 * MIN, T)).outages ?? []).toEqual([]);
  });

  it("sem TV, as estações contam, mas só depois de 10 min de silêncio (aba em segundo plano)", () => {
    const noTv = (stationAt: number | null) => ({
      hasTv: false,
      tvSignalAt: null,
      stationSignalAt: stationAt,
      serverStartedAt: 0,
    });
    let d = freeze(trackOutage(dayWith(["ana"]), T, noTv(T)));
    for (const m of [3, 6, 9]) d = freeze(trackOutage(d, T + m * MIN, noTv(T)));
    expect(inManualMode(d)).toBe(false);
    d = freeze(trackOutage(d, T + NO_TV_SILENCE_MS + MIN, noTv(T)));
    expect(d.outages).toEqual([{ start: T, end: null }]);
  });

  it("TV pareada que ainda não deu sinal nesta sessão (ou desparelhada): contam as estações", () => {
    const sig = (hasTv: boolean, tvAt: number | null, stationAt: number) => ({
      hasTv,
      tvSignalAt: tvAt,
      stationSignalAt: stationAt,
      serverStartedAt: 0,
    });
    let d = freeze(trackOutage(dayWith(["ana"]), T, sig(false, null, T)));
    // TV pareada às 10:00, sem sinal ainda: as estações seguem no ar, não é queda.
    d = freeze(trackOutage(d, T + 3 * MIN, sig(true, null, T + 3 * MIN)));
    expect(inManualMode(d)).toBe(false);
    // A TV dá sinal: daí em diante só ela conta.
    d = freeze(trackOutage(d, T + 4 * MIN, sig(true, T + 4 * MIN, T + 4 * MIN)));
    expect(trackOutage(d, T + 7 * MIN, sig(true, T + 4 * MIN, T + 7 * MIN)).outages).toEqual([
      { start: T + 4 * MIN, end: null },
    ]);
    // Desparelhada, voltam as estações.
    expect(inManualMode(trackOutage(d, T + 7 * MIN, sig(false, null, T + 7 * MIN)))).toBe(false);
  });

  it("queda aberta e ninguém mais chamando (estação fechada): a queda fecha", () => {
    let d = track(alive(dayWith(["ana"]), T), T + 3 * MIN, T);
    expect(inManualMode(d)).toBe(true);
    d = freeze({ ...d, stations: d.stations.map((e) => ({ ...e, open: false })) });
    d = track(d, T + 30 * MIN, T);
    expect(d.outages).toEqual([{ start: T, end: T + 30 * MIN }]);
  });

  it("sessão que não está aberta não muda", () => {
    const d = freeze({ ...alive(dayWith(["ana"]), T), state: "closed" as const });
    expect(trackOutage(d, T + 30 * MIN, signal(T))).toBe(d);
  });
});

describe("PV5: com o sinal parado (queda ainda não confirmada), o atraso não é julgado", () => {
  it("com o sinal parado (queda ainda não confirmada), não sai; com sinal recente ou queda confirmada, decide", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 29 * MIN);
    // 10:31: prazo acabou, mas a TV está calada há 2 min: pode ser uma queda que ainda não se confirmou.
    d = track(d, T + 31 * MIN, T + 29 * MIN);
    expect(turnLostNotices(d, T + 31 * MIN, AUTO).events).toEqual([]);
    // A TV volta: o prazo acabou de verdade.
    const back = track(d, T + 32 * MIN, T + 32 * MIN);
    expect(turnLostNotices(back, T + 32 * MIN, AUTO).events).toHaveLength(1);
  });

  it("quem chega pelo app com o sinal parado mantém o lugar (a queda pode voltar no tempo e estender o prazo)", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 29 * MIN);
    d = track(d, T + 31 * MIN, T + 29 * MIN);
    expect(lateness(d, d.items[0] as never, T + 31 * MIN)).toBe("late_in_contingency");
    const ana = apply(checkIn(d, { itemId: "ana" }, T + 31 * MIN)).items.find((i) => i.id === "ana");
    expect(ana?.number).toBe(1);
  });

  it("o sinal é julgado na hora do giro, não depois: sem TV, a estação em segundo plano não para o atraso", () => {
    const stations = (at: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: at, serverStartedAt: 0 });
    let d = freeze(
      trackOutage(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 29 * MIN, stations(T + 29 * MIN)),
    );
    // Giro às 10:31:00 com o último sinal às 10:29:50 (aba em segundo plano: 70 s, no ar).
    d = freeze(trackOutage(d, T + 31 * MIN, stations(T + 29 * MIN + 50_000)));
    // 10:31:40: o sinal visto no giro teria 110 s agora, mas no giro estava recente: o prazo acabou mesmo.
    expect(lateness(d, d.items[0] as never, T + 31 * MIN + 40_000)).toBe("late");
    expect(turnLostNotices(d, T + 31 * MIN + 40_000, AUTO).events).toHaveLength(1);
  });

  it("com TV, que dá sinal a cada 20 s, 50 s calada no giro já é sinal parado", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 29 * MIN);
    // Giro às 10:30:40, a TV calada desde 10:29:50 (antes do fim do prazo, às 10:30).
    d = track(d, T + 30 * MIN + 40_000, T + 29 * MIN + 50_000);
    expect(lateness(d, d.items[0] as never, T + 30 * MIN + 40_000)).toBe("late_in_contingency");
  });

  it("sem TV, 100 s de silêncio da estação no giro já é sinal parado; com TV, 30 s no giro ainda não", () => {
    const stations = (at: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: at, serverStartedAt: 0 });
    const base = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30);
    let d = freeze(trackOutage(base, T + 28 * MIN, stations(T + 28 * MIN)));
    d = freeze(trackOutage(d, T + 30 * MIN + 30_000, stations(T + 28 * MIN + 45_000)));
    expect(lateness(d, d.items[0] as never, T + 30 * MIN + 30_000)).toBe("late_in_contingency");
    let tv = alive(base, T + 29 * MIN);
    tv = track(tv, T + 30 * MIN + 20_000, T + 29 * MIN + 50_000);
    expect(lateness(tv, tv.items[0] as never, T + 30 * MIN + 20_000)).toBe("late");
  });

  it("a TV cai logo depois do giro: passado o limite e mais um giro, o atraso já espera sem aguardar o próximo", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 29 * MIN);
    // Giro às 10:30:05, a TV com sinal às 10:29:50 (15 s, no ar); depois ela cai.
    d = track(d, T + 30 * MIN + 5_000, T + 29 * MIN + 50_000);
    expect(lateness(d, d.items[0] as never, T + 30 * MIN + 30_000)).toBe("late");
    // 10:31:40: 110 s sem sinal, mais que os 45 s e um giro: pode ser queda.
    expect(lateness(d, d.items[0] as never, T + 31 * MIN + 40_000)).toBe("late_in_contingency");
  });

  it("varredura parada há mais de 2 min com o servidor no ar: o sinal visto já não vale e o atraso espera", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 28 * MIN);
    d = track(d, T + 29 * MIN, T + 29 * MIN);
    expect(lateness(d, d.items[0] as never, T + 31 * MIN + 30_000)).toBe("late_in_contingency");
  });

  it("dia salvo antes de guardar a fonte do sinal: conta como estações", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 28 * MIN);
    d = track(d, T + 30 * MIN + 30_000, T + 28 * MIN + 45_000);
    const { signalSource: _, ...old } = d as SessionDay & { signalSource?: string };
    expect(lateness(old as SessionDay, d.items[0] as never, T + 30 * MIN + 30_000)).toBe("late_in_contingency");
  });

  it("sem ninguém chamando (estação fechada), não há queda a confirmar: o 'perdeu a vez' sai", () => {
    let d = alive(alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30), T + 20 * MIN);
    d = freeze({ ...d, stations: d.stations.map((e) => ({ ...e, open: false })) });
    d = track(d, T + 31 * MIN, T + 20 * MIN);
    expect(turnLostNotices(d, T + 31 * MIN, AUTO).events).toHaveLength(1);
  });
});

describe("PV5: TV trocada e estação reaberta", () => {
  const sig = (hasTv: boolean, tvAt: number | null, stationAt: number | null) => ({
    hasTv,
    tvSignalAt: tvAt,
    stationSignalAt: stationAt,
    serverStartedAt: 0,
  });

  it("TV trocada por uma nova que ainda não deu sinal: voltam as estações", () => {
    let d = freeze(trackOutage(dayWith(["ana"]), T, sig(true, T, T)));
    d = freeze(trackOutage(d, T + 5 * MIN, sig(true, null, T + 5 * MIN)));
    expect(inManualMode(d)).toBe(false);
  });

  it("estação reaberta ainda sem sinal: a nova queda não volta para antes do fim da anterior", () => {
    let d = track(alive(dayWith(["ana"]), T), T + 3 * MIN, T);
    d = freeze({ ...d, stations: d.stations.map((e) => ({ ...e, open: false })) });
    d = track(d, T + 10 * MIN, T);
    d = freeze({ ...d, stations: d.stations.map((e) => ({ ...e, open: true })) });
    d = track(d, T + 20 * MIN, T);
    expect(d.outages).toEqual([
      { start: T, end: T + 10 * MIN },
      { start: T + 10 * MIN, end: null },
    ]);
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
    // A varredura segue girando com a unidade no ar.
    const at = (m: number) => track(d, T + m * MIN, T + m * MIN);
    const ana = (day: SessionDay) => day.items.find((i) => i.id === "ana");
    expect(ana(apply(checkIn(at(49), { itemId: "ana" }, T + 49 * MIN)))?.number).toBe(1);
    expect(ana(apply(checkIn(at(50), { itemId: "ana" }, T + 50 * MIN)))?.number).toBe(3);
    expect(turnLostNotices(at(49), T + 49 * MIN, AUTO).events).toEqual([]);
    expect(turnLostNotices(at(50), T + 50 * MIN, AUTO).events).toHaveLength(1);
  });

  it("em modo manual a estimativa some (o app manda procurar a recepção)", () => {
    const d = track(alive(notified(), T + 20 * MIN), T + 23 * MIN, T + 20 * MIN);
    expect(estimate(d, "bruno", T + 23 * MIN, { manualMode: inManualMode(d) })).toEqual({ kind: "manual_mode" });
  });
});
