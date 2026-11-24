import { describe, expect, it } from "vitest";
import { callNext, closeStation } from "../src/call.ts";
import { comeNowNotices, estimate, leaveHomeNotices } from "../src/estimate.ts";
import { trackOutage } from "../src/outage.ts";
import { pauseStation, reopenStation, resumeStation, stagePause } from "../src/pause.ts";
import { checkIn, type SessionDay, type Station } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { alreadyNotified, dayWith, freeze } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 12, 0);
const AUTO = { manualMode: false };
const DEADLINE = 30 * MIN;

const apply = (r: Result<SessionDay>): SessionDay => {
  if (!r.ok) throw new Error(r.error);
  return freeze(r.state);
};
const station = (day: SessionDay, id = "e1"): Station => {
  const e = day.stations.find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
};
const two = (day: SessionDay): SessionDay =>
  freeze({
    ...day,
    stations: [...day.stations, { id: "e2", stage: "care", services: ["cli"], open: true, calledItemId: null }],
  });
const present = (day: SessionDay, ...ids: string[]) =>
  ids.reduce((d, id) => apply(checkIn(d, { itemId: id }, T - 10 * MIN)), day);

describe("pausa avisada da estação (RN-EST-06)", () => {
  it("sem ninguém a caminho: pausa agora, com a volta opcional", () => {
    const d = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: { at: T + 60 * MIN } }, T));
    expect(station(d).pause).toEqual({ from: T, until: T + 60 * MIN });
    expect(station(apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: null }, T))).pause).toEqual({
      from: T,
      until: null,
    });
  });

  it("com alguém a caminho (venha agora no prazo): a pausa começa depois do prazo de chegada", () => {
    const d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    const p = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    expect(station(p).pause).toEqual({ from: T + DEADLINE, until: null });
  });

  it("recusa com paciente chamado, volta antes do início ou sessão fechada", () => {
    const called = freeze({ ...dayWith(["ana"]), stations: [{ ...station(dayWith(["ana"])), calledItemId: "ana" }] });
    expect(pauseStation(called, { stationId: "e1", back: null }, T)).toEqual({ ok: false, error: "station_has_call" });
    expect(pauseStation(dayWith(["ana"]), { stationId: "e1", back: { at: T } }, T)).toEqual({
      ok: false,
      error: "pause_back_before_start",
    });
    const closed = freeze({ ...dayWith(["ana"]), state: "closed" as const });
    expect(pauseStation(closed, { stationId: "e1", back: null }, T)).toEqual({ ok: false, error: "session_closed" });
  });

  it("chama normalmente até a pausa começar; em pausa, não chama", () => {
    let d = present(alreadyNotified(dayWith(["ana", "bruno", "caio"]), "caio", T - 5 * MIN, 30), "ana", "bruno");
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T)); // começa às 12:30
    d = apply(callNext(d, { stationId: "e1" }, T + 10 * MIN));
    expect(station(d).calledItemId).toBe("ana");
    // Na hora da pausa, "finalizar e chamar o próximo" só finaliza.
    d = apply(callNext(d, { stationId: "e1" }, T + DEADLINE));
    expect(station(d).calledItemId).toBeNull();
    expect(callNext(d, { stationId: "e1" }, T + DEADLINE + MIN)).toEqual({ ok: false, error: "station_paused" });
  });

  it("volta em minutos conta do início da pausa, não da hora do clique", () => {
    const d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    const p = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    expect(station(p).pause).toEqual({ from: T + DEADLINE, until: T + DEADLINE + 60 * MIN });
    // Volta marcada para antes de a pausa começar: recusa.
    expect(pauseStation(d, { stationId: "e1", back: { at: T + 20 * MIN } }, T)).toEqual({
      ok: false,
      error: "pause_back_before_start",
    });
  });

  it("quem está a caminho com o prazo estendido por uma queda: a pausa começa depois do prazo estendido", () => {
    let d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    // Queda de 20 min registrada pela recepção: o prazo da Ana vai a 12:45.
    d = freeze({ ...d, contingencies: [{ start: T - 4 * MIN, end: T + 16 * MIN }] });
    const p = apply(pauseStation(d, { stationId: "e1", back: null }, T + 20 * MIN));
    expect(station(p).pause?.from).toBe(T + 20 * MIN + DEADLINE);
    const late = apply(pauseStation(d, { stationId: "e1", back: null }, T + 26 * MIN));
    // 12:26: o prazo normal (12:25) passou, mas o estendido não: ainda a caminho.
    expect(station(late).pause?.from).toBe(T + 26 * MIN + DEADLINE);
  });

  it("pausar de novo (trocar a volta) mantém o início da pausa", () => {
    const d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    let p = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    p = apply(pauseStation(p, { stationId: "e1", back: { inMin: 30 } }, T + 10 * MIN));
    expect(station(p).pause).toEqual({ from: T + DEADLINE, until: T + DEADLINE + 30 * MIN });
  });

  it("pausar de novo depois de a pausa acabar: é uma pausa nova, que respeita quem está a caminho", () => {
    let d = apply(pauseStation(dayWith(["ana", "bruno"]), { stationId: "e1", back: { inMin: 30 } }, T));
    d = alreadyNotified(d, "ana", T + 120 * MIN, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 30 } }, T + 125 * MIN));
    expect(station(d).pause).toEqual({ from: T + 155 * MIN, until: T + 185 * MIN });
  });

  it("volta com valor inválido é recusada", () => {
    expect(pauseStation(dayWith(["ana"]), { stationId: "e1", back: { inMin: Number.NaN } }, T)).toEqual({
      ok: false,
      error: "pause_back_before_start",
    });
  });

  it("voltar (ou desmarcar) tira a pausa", () => {
    let d = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: null }, T));
    d = apply(resumeStation(d, { stationId: "e1" }, T + 20 * MIN));
    expect(station(d).pause).toBeUndefined();
    expect(resumeStation(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });
});

describe("fechar e reabrir a estação (RN-EST-07)", () => {
  it("fechar tira a pausa; reabrir devolve a estação à sessão", () => {
    let d = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: null }, T));
    d = apply(closeStation(d, { stationId: "e1" }));
    expect(station(d)).toMatchObject({ open: false });
    expect(station(d).pause).toBeUndefined();
    d = apply(reopenStation(d, { stationId: "e1" }, T));
    expect(station(d).open).toBe(true);
    expect(reopenStation(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });
});

describe("pausa da etapa: quando nenhuma estação chama", () => {
  it("só há pausa da etapa quando todas as estações abertas estão em pausa", () => {
    let d = two(dayWith(["ana"]));
    d = apply(pauseStation(d, { stationId: "e1", back: { at: T + 60 * MIN } }, T));
    expect(stagePause(d, "care", T)).toBeNull();
    d = apply(pauseStation(d, { stationId: "e2", back: { at: T + 45 * MIN } }, T));
    expect(stagePause(d, "care", T)).toEqual({ from: T, until: T + 45 * MIN });
    // Estação fechada não conta: a outra em pausa basta.
    const closed = apply(
      closeStation(apply(pauseStation(two(dayWith(["ana"])), { stationId: "e1", back: null }, T)), {
        stationId: "e2",
      }),
    );
    expect(stagePause(closed, "care", T)).toEqual({ from: T, until: null });
  });

  it("a faixa de horário planejada (vão entre faixas) pausa todas as estações", () => {
    const d = dayWith(["ana"], { breaks: [{ start: T + 60 * MIN, end: T + 120 * MIN }] });
    expect(stagePause(d, "care", T)).toEqual({ from: T + 60 * MIN, until: T + 120 * MIN });
    expect(stagePause(d, "care", T + 90 * MIN)).toEqual({ from: T + 60 * MIN, until: T + 120 * MIN });
    expect(stagePause(d, "care", T + 120 * MIN)).toBeNull();
  });
});

describe("estimativa e avisos com a pausa (RN-ETA)", () => {
  it("em pausa com volta: a posição soma o resto da pausa e diz até quando", () => {
    const d = apply(pauseStation(dayWith(["ana", "bruno"]), { stationId: "e1", back: { at: T + 60 * MIN } }, T));
    expect(estimate(d, "bruno", T + 20 * MIN, AUTO)).toEqual({
      kind: "position",
      position: 2,
      minutes: 40 + 15,
      pause: { from: T, until: T + 60 * MIN },
    });
    // O primeiro não recebe "venha agora" durante a pausa.
    expect(estimate(d, "ana", T + 20 * MIN, AUTO)).toMatchObject({ kind: "position", position: 1, minutes: 40 });
    expect(comeNowNotices(d, T + 20 * MIN, AUTO).events).toEqual([]);
  });

  it("em pausa sem hora de volta: posição sem previsão de tempo, sem 'saia de casa'", () => {
    const d = apply(pauseStation(dayWith(["ana", "bruno"]), { stationId: "e1", back: null }, T));
    expect(estimate(d, "bruno", T + MIN, AUTO)).toMatchObject({
      kind: "position",
      position: 2,
      pause: { from: T, until: null },
    });
    expect(leaveHomeNotices(d, T + MIN, AUTO).events).toEqual([]);
  });

  it("pausa à frente: quem seria atendido depois do início soma a pausa; o 'venha agora' não sai se o prazo cai nela", () => {
    const d = dayWith(["ana", "bruno"], { breaks: [{ start: T + 20 * MIN, end: T + 80 * MIN }] });
    // Bruno: 1 à frente × 15 min = 12:15, antes da pausa: não soma.
    expect(estimate(d, "bruno", T, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
    // Ana é a próxima, mas chegaria (prazo de 30 min) dentro da pausa: sem "venha agora".
    expect(estimate(d, "ana", T, AUTO)).toMatchObject({ kind: "position", position: 1 });
    expect(comeNowNotices(d, T, AUTO).events).toEqual([]);
    // Bem antes da pausa, o "venha agora" sai normalmente.
    const early = dayWith(["ana", "bruno"], { breaks: [{ start: T + 40 * MIN, end: T + 80 * MIN }] });
    expect(estimate(early, "ana", T, AUTO)).toEqual({ kind: "come_now" });
    // Depois da pausa, de volta ao normal.
    expect(estimate(d, "ana", T + 80 * MIN, AUTO)).toEqual({ kind: "come_now" });
  });

  it("quem já recebeu 'venha agora' continua com ele quando a pausa é marcada (está a caminho)", () => {
    let d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    expect(estimate(d, "ana", T + MIN, AUTO)).toEqual({ kind: "come_now" });
  });

  it("quem já chegou (ou perdeu a vez) vê a pausa no tempo, mesmo tendo recebido 'venha agora'", () => {
    let d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    d = present(d, "ana");
    d = apply(pauseStation(d, { stationId: "e1", back: { at: T + 60 * MIN } }, T));
    expect(estimate(d, "ana", T + 20 * MIN, AUTO)).toMatchObject({ pause: { from: T, until: T + 60 * MIN } });
  });

  it("com outra estação chamando, a pausa de uma não para a fila nem o 'venha agora'", () => {
    const d = apply(pauseStation(two(dayWith(["ana", "bruno"])), { stationId: "e1", back: null }, T));
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "come_now" });
    // Só uma estação chamando: 1 à frente × 15 min.
    expect(estimate(d, "bruno", T, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
  });
});

describe("queda percebida com a pausa (QP6)", () => {
  it("pausa que acaba com a aba fechada: o silêncio conta da volta, e a queda começa nela", () => {
    const signal = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = freeze(trackOutage(dayWith(["ana"]), T, signal(T)));
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    // 13:05: a pausa acabou às 13:00 e a aba ainda não voltou: 5 min de silêncio, não 65.
    d = freeze(trackOutage(d, T + 65 * MIN, signal(T)));
    expect(d.outages ?? []).toEqual([]);
    d = freeze(trackOutage(d, T + 71 * MIN, signal(T)));
    expect(d.outages).toEqual([{ start: T + 60 * MIN, end: null }]);
  });

  it("'voltar agora' ou reabrir com a aba ainda fechada: o silêncio conta da volta, não de antes da pausa", () => {
    const signal = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = freeze(trackOutage(dayWith(["ana"]), T, signal(T)));
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    d = apply(resumeStation(d, { stationId: "e1" }, T + 60 * MIN));
    expect(freeze(trackOutage(d, T + 65 * MIN, signal(T))).outages ?? []).toEqual([]);
    let c = apply(closeStation(freeze(trackOutage(dayWith(["ana"]), T, signal(T))), { stationId: "e1" }));
    c = apply(reopenStation(c, { stationId: "e1" }, T + 60 * MIN));
    expect(freeze(trackOutage(c, T + 65 * MIN, signal(T))).outages ?? []).toEqual([]);
  });

  it("pausa planejada da sessão (almoço, TV desligada): o silêncio da TV conta da volta", () => {
    const tv = (last: number) => ({ hasTv: true, tvSignalAt: last, stationSignalAt: null, serverStartedAt: 0 });
    let d = dayWith(["ana"], { breaks: [{ start: T + 60 * MIN, end: T + 120 * MIN }] });
    d = freeze(trackOutage(d, T + 59 * MIN, tv(T + 59 * MIN)));
    d = freeze(trackOutage(d, T + 121 * MIN, tv(T + 59 * MIN)));
    expect(d.outages ?? []).toEqual([]);
  });

  it("estação em pausa ou fechada não conta como 'chamando': o silêncio dela não é queda", () => {
    const signal = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = freeze(trackOutage(dayWith(["ana"]), T, signal(T)));
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    expect(trackOutage(d, T + 15 * MIN, signal(T)).outages ?? []).toEqual([]);
    const closed = apply(closeStation(freeze(trackOutage(dayWith(["ana"]), T, signal(T))), { stationId: "e1" }));
    expect(trackOutage(closed, T + 15 * MIN, signal(T)).outages ?? []).toEqual([]);
  });
});
