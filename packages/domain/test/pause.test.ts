import { describe, expect, it } from "vitest";
import { callNext, closeStation, finish, noShow } from "../src/call.ts";
import { averageTime, comeNowNotices, estimate, leaveHomeNotices } from "../src/estimate.ts";
import { stalledSince, trackOutage } from "../src/outage.ts";
import {
  confirmPause,
  pauseStartNotices,
  pauseStation,
  reopenStation,
  resumeStation,
  serveBeforePause,
  stagePause,
  waitingBeforePause,
} from "../src/pause.ts";
import { checkIn, lateness, type SessionDay, type Station } from "../src/queue.ts";
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
    expect(station(p).pause).toEqual({ from: T + DEADLINE, until: null, waitFor: ["ana"] });
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
    expect(station(p).pause).toEqual({ from: T + DEADLINE, until: T + DEADLINE + 60 * MIN, waitFor: ["ana"] });
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

  it("pausar de novo depois de a pausa acabar: é uma pausa nova, que respeita quem está a caminho", () => {
    let d = apply(pauseStation(dayWith(["ana", "bruno"]), { stationId: "e1", back: { inMin: 30 } }, T));
    d = alreadyNotified(d, "ana", T + 120 * MIN, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 30 } }, T + 125 * MIN));
    expect(station(d).pause).toEqual({ from: T + 155 * MIN, until: T + 185 * MIN, waitFor: ["ana"] });
  });

  it("'voltar agora' recusa a pausa que já acabou; no almoço, tira a pausa própria, mas o almoço segue", () => {
    const d = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: { inMin: 30 } }, T));
    expect(resumeStation(d, { stationId: "e1" }, T + 40 * MIN)).toEqual({ ok: false, error: "forbidden_transition" });
    const lunch = apply(
      pauseStation(
        present(dayWith(["ana"], { breaks: [{ start: T, end: T + 60 * MIN }] }), "ana"),
        { stationId: "e1", back: null },
        T - 10 * MIN,
      ),
    );
    const back = apply(resumeStation(lunch, { stationId: "e1" }, T + 30 * MIN));
    expect(station(back).pause).toBeUndefined();
    expect(callNext(back, { stationId: "e1" }, T + 30 * MIN)).toEqual({ ok: false, error: "session_break" });
    expect(station(apply(callNext(back, { stationId: "e1" }, T + 60 * MIN))).calledItemId).toBe("ana");
  });

  it("no almoço da sessão, dá para desmarcar uma pausa própria que ainda não começou", () => {
    let d = dayWith(["ana"], { breaks: [{ start: T, end: T + 60 * MIN }] });
    d = freeze({ ...d, stations: d.stations.map((e) => ({ ...e, pause: { from: T + 180 * MIN, until: null } })) });
    expect(station(apply(resumeStation(d, { stationId: "e1" }, T + 30 * MIN))).pause).toBeUndefined();
  });

  it("com pausa marcada ou em curso, pausar de novo é recusado: volte (ou desmarque) antes", () => {
    const d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 5 * MIN, 30);
    const staged = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    expect(pauseStation(staged, { stationId: "e1", back: { inMin: 30 } }, T + 10 * MIN)).toEqual({
      ok: false,
      error: "station_already_paused",
    });
    const running = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: null }, T));
    expect(pauseStation(running, { stationId: "e1", back: { inMin: 30 } }, T + 40 * MIN)).toEqual({
      ok: false,
      error: "station_already_paused",
    });
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
    d = apply(closeStation(d, { stationId: "e1" }, T));
    expect(station(d)).toMatchObject({ open: false });
    expect(station(d).pause).toBeUndefined();
    d = apply(reopenStation(d, { stationId: "e1" }, T));
    expect(station(d).open).toBe(true);
    expect(reopenStation(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });
});

describe("fechar depois de uma pausa", () => {
  it("a pausa que já acabou entra no histórico só até a volta; fechar de novo não muda nada", () => {
    let d = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: { inMin: 15 } }, T));
    d = apply(closeStation(d, { stationId: "e1" }, T + 120 * MIN));
    expect(station(d).stops).toEqual([{ start: T, end: T + 15 * MIN }]);
    // Fechar de novo (toque duplo, nova tentativa) não muda nada.
    expect(closeStation(d, { stationId: "e1" }, T + 130 * MIN)).toEqual({ ok: true, state: d, events: [] });
  });
});

describe("auditoria e quem está a caminho", () => {
  it("pausar, voltar, fechar e reabrir geram eventos para a auditoria", () => {
    const p = pauseStation(dayWith(["ana"]), { stationId: "e1", back: null }, T);
    expect(p.ok && p.events).toEqual([{ kind: "station_paused", stationId: "e1", data: { from: T, until: null } }]);
    const r = resumeStation(apply(p), { stationId: "e1" }, T + MIN);
    expect(r.ok && r.events).toEqual([{ kind: "station_resumed", stationId: "e1" }]);
    const c = closeStation(dayWith(["ana"]), { stationId: "e1" }, T);
    expect(c.ok && c.events).toEqual([{ kind: "station_closed", stationId: "e1" }]);
    const o = reopenStation(apply(c), { stationId: "e1" }, T + MIN);
    expect(o.ok && o.events).toEqual([{ kind: "station_reopened", stationId: "e1" }]);
  });

  it("urgência confirmada que passou do prazo sem chegar não segura a pausa (PA5)", () => {
    let d = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T - 35 * MIN, 30);
    d = freeze({ ...d, items: d.items.map((i) => (i.id === "ana" ? { ...i, confirmedUrgency: true } : i)) });
    expect(station(apply(pauseStation(d, { stationId: "e1", back: null }, T))).pause?.from).toBe(T);
  });

  it("sem estação chamando, o sinal parado é o último sinal (não uma hora no futuro)", () => {
    const st = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = freeze(trackOutage(dayWith(["ana"]), T, st(T)));
    d = apply(closeStation(d, { stationId: "e1" }, T + MIN));
    expect(stalledSince(d, T + 2 * MIN)).toBe(T);
  });

  it("a caminho com o prazo estendido depois de a pausa começar: continua com 'venha agora'", () => {
    let d = alreadyNotified(dayWith(["bia", "bruno"]), "bia", T, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: { at: T + 60 * MIN } }, T + 2 * MIN));
    d = freeze({ ...d, contingencies: [{ start: T + 5 * MIN, end: T + 15 * MIN }] });
    expect(estimate(d, "bia", T + 33 * MIN, AUTO)).toEqual({ kind: "come_now" });
  });
});

describe("pausa e queda da unidade", () => {
  it("com queda aberta ou ainda não confirmada não dá para pausar (os prazos de quem vem estão em aberto)", () => {
    const open = freeze({ ...dayWith(["ana"]), outages: [{ start: T - 5 * MIN, end: null }] });
    expect(pauseStation(open, { stationId: "e1", back: null }, T)).toEqual({ ok: false, error: "pause_during_outage" });
    const st = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let pending = freeze(trackOutage(dayWith(["ana"]), T - 5 * MIN, st(T - 5 * MIN)));
    pending = freeze(trackOutage(pending, T, st(T - 5 * MIN)));
    expect(pauseStation(pending, { stationId: "e1", back: null }, T)).toEqual({
      ok: false,
      error: "pause_during_outage",
    });
  });

  it("a volta de uma estação não fecha a queda aberta: só o sinal de verdade fecha", () => {
    const st = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    const base = dayWith(["ana"]);
    const d = freeze({
      ...base,
      outages: [{ start: T, end: null }],
      liveSignalAt: T - MIN,
      stations: base.stations.map((e) => ({ ...e, callingSince: T + 20 * MIN })),
    });
    expect(trackOutage(d, T + 21 * MIN, st(T - MIN)).outages).toEqual([{ start: T, end: null }]);
  });

  it("no almoço da sessão, chamar diz que é o intervalo (não há pausa própria para tirar)", () => {
    const d = present(dayWith(["ana"], { breaks: [{ start: T, end: T + 60 * MIN }] }), "ana");
    expect(callNext(d, { stationId: "e1" }, T + 10 * MIN)).toEqual({ ok: false, error: "session_break" });
  });
});

describe("quem estava a caminho chegou e não foi chamado antes da pausa (opção C)", () => {
  // Bia recebe "venha agora" às 11:55 (prazo 12:25); a pausa é marcada às 12:00 para 12:30, volta em 1 h.
  // Ana está sendo atendida das 12:15 até depois das 12:30; Bia chega às 12:20.
  const scene = () => {
    let d = present(alreadyNotified(dayWith(["ana", "bia", "caio"]), "bia", T - 5 * MIN, 30), "ana");
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    // 12:31: Ana sai; a pausa já chegou, então ninguém é chamado.
    return apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
  };

  it("a estação vê quem chegou no prazo e ainda não foi chamado (só depois da hora da pausa)", () => {
    const d = scene();
    expect(station(d).calledItemId).toBeNull();
    expect(waitingBeforePause(d, "e1", T + 31 * MIN).map((i) => i.id)).toEqual(["bia"]);
    expect(waitingBeforePause(d, "e1", T + 29 * MIN)).toEqual([]);
  });

  it("atender antes de pausar: chama a Bia; a pausa começa ao finalizar e a volta anda o mesmo tanto", () => {
    let d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    expect(station(d).calledItemId).toBe("bia");
    // Outros remotos continuam sem "venha agora" (a pausa segue à frente).
    expect(estimate(d, "caio", T + 35 * MIN, AUTO)).toMatchObject({ kind: "position" });
    d = apply(finish(d, { stationId: "e1" }, T + 46 * MIN));
    expect(station(d).pause).toEqual({ from: T + 46 * MIN, until: T + 106 * MIN });
    expect(callNext(d, { stationId: "e1" }, T + 47 * MIN)).toEqual({ ok: false, error: "station_paused" });
  });

  it("atender antes de pausar e chamar o próximo ao finalizar: sem mais ninguém esperando, pausa em vez de chamar", () => {
    let d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    d = apply(callNext(d, { stationId: "e1" }, T + 46 * MIN));
    expect(station(d).calledItemId).toBeNull();
    expect(station(d).pause).toEqual({ from: T + 46 * MIN, until: T + 106 * MIN });
  });

  it("atender antes de pausar e a Bia não comparece: a pausa começa (ela não segura mais a pausa)", () => {
    let d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    d = apply(noShow(d, { stationId: "e1" }, T + 36 * MIN));
    expect(station(d).pause).toEqual({ from: T + 36 * MIN, until: T + 96 * MIN });
  });

  it("pausar agora: a Bia recebe a justificativa (uma vez) e continua na frente da fila", () => {
    const r = confirmPause(scene(), { stationId: "e1" }, T + 31 * MIN);
    expect(r.ok && r.events).toEqual([
      { kind: "turn_after_pause", itemId: "bia", stationId: "e1", data: { until: T + 90 * MIN } },
    ]);
    const d = apply(r);
    expect(waitingBeforePause(d, "e1", T + 32 * MIN)).toEqual([]);
    expect(confirmPause(d, { stationId: "e1" }, T + 32 * MIN)).toEqual({ ok: true, state: d, events: [] });
  });

  it("ninguém respondeu: a varredura manda a justificativa quando a pausa começa, uma vez", () => {
    const first = pauseStartNotices(scene(), T + 32 * MIN);
    expect(first.events.map((e) => [e.kind, e.itemId])).toEqual([["turn_after_pause", "bia"]]);
    expect(pauseStartNotices(first.day, T + 33 * MIN).events).toEqual([]);
  });

  it("atender antes de pausar sem ninguém esperando é recusado", () => {
    const d = apply(pauseStation(dayWith(["ana"]), { stationId: "e1", back: null }, T));
    expect(serveBeforePause(d, { stationId: "e1" }, T + MIN)).toEqual({ ok: false, error: "forbidden_transition" });
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
      closeStation(
        apply(pauseStation(two(dayWith(["ana"])), { stationId: "e1", back: null }, T)),
        {
          stationId: "e2",
        },
        T,
      ),
    );
    expect(stagePause(closed, "care", T)).toEqual({ from: T, until: null });
  });

  it("pausa da estação emendada no almoço: a pausa da etapa vale desde o começo da primeira", () => {
    let d = dayWith(["ana"], { breaks: [{ start: T + 30 * MIN, end: T + 90 * MIN }] });
    d = apply(pauseStation(d, { stationId: "e1", back: { at: T + 30 * MIN } }, T));
    expect(stagePause(d, "care", T + 45 * MIN)).toEqual({ from: T, until: T + 90 * MIN });
  });

  it("a faixa de horário planejada (vão entre faixas) pausa todas as estações", () => {
    const d = dayWith(["ana"], { breaks: [{ start: T + 60 * MIN, end: T + 120 * MIN }] });
    expect(stagePause(d, "care", T)).toEqual({ from: T + 60 * MIN, until: T + 120 * MIN });
    expect(stagePause(d, "care", T + 90 * MIN)).toEqual({ from: T + 60 * MIN, until: T + 120 * MIN });
    expect(stagePause(d, "care", T + 120 * MIN)).toBeNull();
  });
});

describe("estimativa e avisos com a pausa (RN-ETA)", () => {
  it("o tempo médio também tira a pausa já encerrada ('voltar agora') e o tempo fechada", () => {
    const ids = ["a", "b", "c", "d", "e"];
    let d = present(dayWith(ids), ...ids);
    const at = [-45, -30, -15, 0].map((m, k) => ({
      itemId: ids[k] as string,
      stationId: "e1",
      stage: "care" as const,
      at: T + m * MIN,
    }));
    d = freeze({ ...d, calls: [...d.calls, ...at] as never });
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T + 10 * MIN));
    d = apply(resumeStation(d, { stationId: "e1" }, T + 30 * MIN));
    d = freeze({
      ...d,
      calls: [...d.calls, { itemId: "e", stationId: "e1", stage: "care" as const, at: T + 35 * MIN }] as never,
    });
    // 15, 15, 15 e 35 - 20 de pausa = 15.
    expect(averageTime(d, "care", d.serviceId, T + 40 * MIN)).toBe(15);
    let c: SessionDay = freeze({ ...present(dayWith(ids), ...ids), calls: at as never });
    c = apply(closeStation(c, { stationId: "e1" }, T + 10 * MIN));
    c = apply(reopenStation(c, { stationId: "e1" }, T + 30 * MIN));
    c = freeze({
      ...c,
      calls: [...c.calls, { itemId: "e", stationId: "e1", stage: "care" as const, at: T + 35 * MIN }] as never,
    });
    expect(averageTime(c, "care", c.serviceId, T + 40 * MIN)).toBe(15);
  });

  it("a caminho, mas não o primeiro, com a pausa já em curso: vê a pausa no tempo", () => {
    let d = dayWith(["ana", "bruno"], { breaks: [{ start: T, end: T + 60 * MIN }] });
    d = alreadyNotified(d, "bruno", T - 10 * MIN, 30);
    expect(estimate(d, "bruno", T + 5 * MIN, AUTO)).toMatchObject({ pause: { from: T, until: T + 60 * MIN } });
  });

  it("na triagem, a previsão da consulta soma a pausa da triagem e some sem hora de volta no atendimento", () => {
    const base = dayWith(["ana", "joao"], {
      stations: [
        { id: "tri", stage: "triage", services: ["cli"], open: true, calledItemId: null },
        { id: "e1", stage: "care", services: ["cli"], open: true, calledItemId: null },
      ],
      initialTimeMin: { triage: 5 },
    });
    const tri = freeze({ ...base, items: base.items.map((i) => ({ ...i, stage: "triage" as const })) });
    const paused = apply(pauseStation(tri, { stationId: "tri", back: { at: T + 60 * MIN } }, T));
    // Triagem: 60 de pausa + 1 × 5; consulta: isso + 1 × 15.
    expect(estimate(paused, "joao", T, AUTO)).toMatchObject({ minutes: 65, query: { minutes: 80 } });
    const care = apply(pauseStation(tri, { stationId: "e1", back: null }, T));
    expect(estimate(care, "joao", T, AUTO)).not.toHaveProperty("query");
  });

  it("espera que atravessa duas pausas soma as duas (PA1)", () => {
    const ids = Array.from({ length: 10 }, (_, k) => `p${k}`);
    // 09:50; pausa do consultório das 10:00 às 10:30 e almoço das 12:00 às 13:00.
    const now = T - 130 * MIN;
    let d = dayWith(ids, { breaks: [{ start: T, end: T + 60 * MIN }] });
    d = freeze({
      ...d,
      stations: d.stations.map((e) => ({ ...e, pause: { from: T - 120 * MIN, until: T - 90 * MIN } })),
    });
    // 9 à frente × 15 = 135 min de fila: 10 até a 1ª pausa, 90 entre as pausas, 35 depois do almoço (13:35).
    expect(estimate(d, "p9", now, AUTO)).toMatchObject({ position: 10, minutes: 225 });
  });

  it("o tempo médio de atendimento não conta o almoço como atendimento", () => {
    let d = present(
      dayWith(["a", "b", "c", "d", "e"], { breaks: [{ start: T, end: T + 30 * MIN }] }),
      "a",
      "b",
      "c",
      "d",
      "e",
    );
    const calls = [-50, -35, -20, -5, 40].map((m, k) => ({
      itemId: ["a", "b", "c", "d", "e"][k] as string,
      stationId: "e1",
      stage: "care" as const,
      at: T + m * MIN,
    }));
    d = freeze({ ...d, calls: [...d.calls, ...calls] as never });
    // 15, 15, 15 e 45 - 30 de almoço = 15.
    expect(averageTime(d, "care", d.serviceId, T + 60 * MIN)).toBe(15);
  });

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
    // Bruno: 1 à frente × 15 min = 12:15, mas o prazo de chegada cai na pausa: só é chamado na volta.
    expect(estimate(d, "bruno", T, AUTO)).toMatchObject({ kind: "position", position: 2, minutes: 80 });
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

  it("em casa e não o primeiro: se a vez cair perto da pausa (prazo de chegada), soma a pausa e não manda sair cedo", () => {
    // Pausa das 12:20 às 13:20; Bruno seria chamado às 12:15, mas o "venha agora" não sai com a pausa a menos
    // de 30 min: ele só é chamado na volta.
    const d = dayWith(["ana", "bruno"], { breaks: [{ start: T + 20 * MIN, end: T + 80 * MIN }] });
    expect(estimate(d, "bruno", T, AUTO)).toMatchObject({ kind: "position", position: 2, minutes: 80 });
    expect(leaveHomeNotices(d, T, AUTO).events).toEqual([]);
  });

  it("pausa curta de uma estação (com volta) não corta a capacidade da fila; sem volta, corta", () => {
    const short = apply(
      pauseStation(two(dayWith(["ana", "bruno", "caio"])), { stationId: "e1", back: { inMin: 5 } }, T),
    );
    // Duas estações: 2 à frente × 15 min / 2.
    expect(estimate(short, "caio", T, AUTO)).toEqual({ kind: "position", position: 3, minutes: 15 });
    const later = apply(pauseStation(two(dayWith(["ana", "bruno", "caio"])), { stationId: "e1", back: null }, T));
    const staged = freeze({
      ...later,
      stations: later.stations.map((e) => (e.id === "e1" ? { ...e, pause: { from: T + 5 * MIN, until: null } } : e)),
    });
    // A outra vai parar sem hora de volta: conta só uma.
    expect(estimate(staged, "caio", T, AUTO)).toEqual({ kind: "position", position: 3, minutes: 30 });
  });

  it("pausa sem volta marcada para bem depois da vez: a estação ainda conta na capacidade", () => {
    const d = two(dayWith(["ana", "bruno", "caio"]));
    const staged = freeze({
      ...d,
      stations: d.stations.map((e) => (e.id === "e2" ? { ...e, pause: { from: T + 120 * MIN, until: null } } : e)),
    });
    expect(estimate(staged, "caio", T, AUTO)).toEqual({ kind: "position", position: 3, minutes: 15 });
  });

  it("na triagem, a pausa do atendimento que cai na espera conta, mesmo havendo outra que acaba antes", () => {
    const base = dayWith(["ana", "joao", "c1", "c2", "c3"], {
      stations: [
        { id: "tri", stage: "triage", services: ["cli"], open: true, calledItemId: null },
        {
          id: "e1",
          stage: "care",
          services: ["cli"],
          open: true,
          calledItemId: null,
          pause: { from: T, until: T + 3 * MIN },
        },
      ],
      initialTimeMin: { triage: 5 },
      breaks: [{ start: T + 40 * MIN, end: T + 100 * MIN }],
    });
    const tri = freeze({
      ...base,
      items: base.items.map((i) => (["ana", "joao"].includes(i.id) ? { ...i, stage: "triage" as const } : i)),
    });
    // Triagem 5; consulta: 5 + 4 × 15 + 60 do almoço.
    expect(estimate(tri, "joao", T, AUTO)).toMatchObject({ minutes: 5, query: { minutes: 125 } });
  });

  it("na triagem, pausa sem volta do atendimento bem depois da consulta: a previsão da consulta continua", () => {
    const base = dayWith(["ana", "joao"], {
      stations: [
        { id: "tri", stage: "triage", services: ["cli"], open: true, calledItemId: null },
        {
          id: "e1",
          stage: "care",
          services: ["cli"],
          open: true,
          calledItemId: null,
          pause: { from: T + 300 * MIN, until: null },
        },
      ],
      initialTimeMin: { triage: 5 },
    });
    const tri = freeze({ ...base, items: base.items.map((i) => ({ ...i, stage: "triage" as const })) });
    expect(estimate(tri, "joao", T, AUTO)).toMatchObject({ minutes: 5, query: { minutes: 20 } });
  });

  it("a caminho e não mais o primeiro: não vê a pausa do consultório, mas vê o almoço da sessão (PA6)", () => {
    let d = alreadyNotified(dayWith(["urg", "bia", "caio"]), "bia", T, 30);
    d = present(d, "urg");
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T + 2 * MIN));
    expect(estimate(d, "bia", T + 5 * MIN, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
    const lunch = alreadyNotified(
      present(dayWith(["urg", "bia"], { breaks: [{ start: T + 10 * MIN, end: T + 70 * MIN }] }), "urg"),
      "bia",
      T,
      30,
    );
    expect(estimate(lunch, "bia", T + 5 * MIN, AUTO)).toMatchObject({
      pause: { from: T + 10 * MIN, until: T + 70 * MIN },
    });
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
    let c = apply(closeStation(freeze(trackOutage(dayWith(["ana"]), T, signal(T))), { stationId: "e1" }, T));
    c = apply(reopenStation(c, { stationId: "e1" }, T + 60 * MIN));
    expect(freeze(trackOutage(c, T + 65 * MIN, signal(T))).outages ?? []).toEqual([]);
  });

  it("sem nenhum sinal da fonte que conta, a volta da pausa não põe a unidade no ar", () => {
    const tv = (last: number | null) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = freeze(trackOutage(dayWith(["ana"]), T, tv(T)));
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 30 } }, T));
    d = freeze(trackOutage(d, T + 31 * MIN, tv(null)));
    expect(d.outages).toEqual([{ start: T + 31 * MIN, end: null }]);
  });

  it("sinal de ontem e a volta do almoço não fazem a unidade 'começar' (nem cair depois)", () => {
    const st = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = dayWith(["ana"], { breaks: [{ start: T, end: T + 60 * MIN }] });
    d = freeze(trackOutage(d, T + 61 * MIN, st(T - 24 * 60 * MIN)));
    expect(d.liveSignalAt).toBeUndefined();
    d = freeze(trackOutage(d, T + 75 * MIN, st(T - 24 * 60 * MIN)));
    expect(d.outages ?? []).toEqual([]);
  });

  it("pausa nova marcada depois de a anterior acabar: o silêncio continua contando do fim da anterior", () => {
    const st = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = freeze(trackOutage(dayWith(["ana", "bruno"]), T, st(T)));
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = alreadyNotified(d, "ana", T + 60 * MIN, 30);
    // Giro logo depois da volta (sinal ainda recente pela volta): dá para pausar de novo.
    d = freeze(trackOutage(d, T + 61 * MIN, st(T)));
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T + 61 * MIN));
    expect(freeze(trackOutage(d, T + 69 * MIN, st(T))).outages ?? []).toEqual([]);
  });

  it("prazo que acabou na pausa e a unidade calada depois dela: a queda começaria na volta, então perdeu a vez", () => {
    const st = (last: number) => ({ hasTv: false, tvSignalAt: null, stationSignalAt: last, serverStartedAt: 0 });
    let d = dayWith(["ana", "bruno"], { breaks: [{ start: T, end: T + 60 * MIN }] });
    d = freeze(trackOutage(d, T - 10 * MIN, st(T - 10 * MIN)));
    d = alreadyNotified(d, "ana", T, 30);
    d = freeze(trackOutage(d, T + 62 * MIN, st(T - 10 * MIN)));
    expect(lateness(d, d.items.find((i) => i.id === "ana") as never, T + 62 * MIN)).toBe("late");
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
    const closed = apply(closeStation(freeze(trackOutage(dayWith(["ana"]), T, signal(T))), { stationId: "e1" }, T));
    expect(trackOutage(closed, T + 15 * MIN, signal(T)).outages ?? []).toEqual([]);
  });
});
