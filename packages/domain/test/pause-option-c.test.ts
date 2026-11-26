import { describe, expect, it } from "vitest";
import { callNext, closeStation, finish, noShow } from "../src/call.ts";
import { estimate } from "../src/estimate.ts";
import {
  advancePauses,
  PAUSE_ANSWER_MS,
  pauseAnswerTimeouts,
  pauseNow,
  pauseState,
  pauseStation,
  resumeStation,
  serveBeforePause,
  waitingBeforePause,
} from "../src/pause.ts";
import { pausedAt } from "../src/pause-time.ts";
import { checkIn, type SessionDay, type Station } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { alreadyNotified, dayWith, freeze, inRoom } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 12, 0);
const AUTO = { manualMode: false };

const apply = (r: Result<SessionDay>): SessionDay => {
  if (!r.ok) throw new Error(r.error);
  return freeze(r.state);
};
const station = (day: SessionDay, id = "e1"): Station => {
  const e = day.stations.find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
};
const present = (day: SessionDay, ...ids: string[]) =>
  ids.reduce((d, id) => apply(checkIn(d, { itemId: id }, T - 10 * MIN)), day);
const two = (day: SessionDay): SessionDay =>
  freeze({
    ...day,
    stations: [...day.stations, { id: "e2", stage: "care", services: ["cli"], open: true, calledItemId: null }],
  });
const kinds = (r: Result<SessionDay>) => (r.ok ? r.events.map((e) => [e.kind, e.itemId ?? null]) : r.error);

/**
 * Bia recebe "venha agora" às 11:55 (prazo 12:25); a pausa é marcada às 12:00 para 12:30, volta em 1 h.
 * Ana é atendida das 12:15 até 12:31; Bia chega às 12:20. Às 12:31 a Ana sai e a pausa já chegou.
 */
const scene = (extra: (d: SessionDay) => SessionDay = (d) => d) => {
  let d = present(alreadyNotified(dayWith(["ana", "bia", "caio"]), "bia", T - 5 * MIN, 30), "ana");
  d = extra(d);
  d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
  d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
  d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
  return apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
};

describe("quem estava a caminho chegou e não foi chamado antes da pausa (opção C)", () => {
  it("marcar a pausa guarda quem estava a caminho", () => {
    const d = present(alreadyNotified(dayWith(["ana", "bia"]), "bia", T - 5 * MIN, 30), "ana");
    const p = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    expect(station(p).pause).toEqual({
      state: "scheduled",
      from: T + 30 * MIN,
      until: null,
      waitFor: [{ id: "bia", by: T + 25 * MIN }],
    });
  });

  it("na hora da pausa, com a Bia esperando, a estação pergunta (não chama e não pausa sozinha)", () => {
    const d = scene();
    expect(station(d).calledItemId).toBeNull();
    expect(station(d).pause).toEqual({
      state: "asking",
      since: T + 31 * MIN,
      askedAt: T + 31 * MIN,
      until: T + 90 * MIN,
      waitFor: ["bia"],
    });
    expect(waitingBeforePause(d, "e1", T + 31 * MIN).map((i) => i.id)).toEqual(["bia"]);
    expect(callNext(d, { stationId: "e1" }, T + 32 * MIN)).toEqual({ ok: false, error: "pause_has_waiting" });
    // Perguntando, a estação não está chamando: o silêncio não é queda.
    expect(pausedAt(d, station(d), T + 32 * MIN)).toBe(true);
  });

  it("antes da hora da pausa, a Bia é chamada normalmente e não segura a pausa", () => {
    let d = present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30));
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = apply(checkIn(d, { itemId: "bia" }, T + 10 * MIN));
    d = apply(callNext(d, { stationId: "e1" }, T + 11 * MIN));
    d = apply(finish(d, { stationId: "e1" }, T + 31 * MIN));
    expect(pauseState(station(d))).toBe("paused");
  });

  it("quem não chegou no prazo não segura a pausa: ela começa na hora", () => {
    let d = alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    expect(pausedAt(d, station(d), T + 31 * MIN)).toBe(true);
    expect(waitingBeforePause(d, "e1", T + 31 * MIN)).toEqual([]);
  });

  it("quem chega atrasado depois da hora da pausa não entra na pergunta", () => {
    let d = present(alreadyNotified(dayWith(["ana", "bia"]), "bia", T - 5 * MIN, 30), "ana");
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
    d = apply(checkIn(d, { itemId: "bia" }, T + 33 * MIN));
    d = apply(finish(d, { stationId: "e1" }, T + 35 * MIN));
    expect(pauseState(station(d))).toBe("paused");
  });

  it("atender antes de pausar: chama a Bia; a pausa começa ao finalizar e a volta anda o mesmo tanto", () => {
    let d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    expect(station(d).calledItemId).toBe("bia");
    expect(station(d).pause).toMatchObject({ state: "serving", length: 59 * MIN, waitFor: ["bia"] });
    d = apply(finish(d, { stationId: "e1" }, T + 46 * MIN));
    expect(station(d).pause).toEqual({ state: "paused", since: T + 46 * MIN, until: T + 105 * MIN });
    expect(callNext(d, { stationId: "e1" }, T + 47 * MIN)).toEqual({ ok: false, error: "station_paused" });
  });

  it("atender antes e 'finalizar e chamar o próximo': sem mais ninguém esperando, pausa em vez de chamar", () => {
    let d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    const r = callNext(d, { stationId: "e1" }, T + 46 * MIN);
    expect(kinds(r)).toEqual([
      ["attended", "bia"],
      ["station_paused", null],
    ]);
    d = apply(r);
    expect(station(d).calledItemId).toBeNull();
    expect(station(d).pause).toEqual({ state: "paused", since: T + 46 * MIN, until: T + 105 * MIN });
  });

  it("atender antes e a Bia não comparece: a pausa começa (ela não segura mais a pausa)", () => {
    let d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    d = apply(noShow(d, { stationId: "e1" }, T + 36 * MIN));
    expect(station(d).pause).toEqual({ state: "paused", since: T + 36 * MIN, until: T + 95 * MIN });
  });

  it("atender antes chama quem estava a caminho, não quem estava na frente sem ter sido avisado", () => {
    let d = present(alreadyNotified(dayWith(["ana", "carlos", "bia"]), "bia", T - 5 * MIN, 30), "ana", "carlos");
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    d = apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
    d = apply(serveBeforePause(d, { stationId: "e1" }, T + 31 * MIN));
    expect(station(d).calledItemId).toBe("bia");
    d = apply(callNext(d, { stationId: "e1" }, T + 46 * MIN));
    expect(station(d).calledItemId).toBeNull();
    expect(pauseState(station(d))).toBe("paused");
  });

  it("com mais alguém esperando, ao finalizar a estação pergunta de novo (os 3 min contam de agora)", () => {
    let d = present(alreadyNotified(dayWith(["ana", "bia", "caio"]), "bia", T - 5 * MIN, 30), "ana");
    d = alreadyNotified(d, "caio", T - 5 * MIN, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    d = apply(checkIn(d, { itemId: "caio" }, T + 22 * MIN));
    d = apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
    expect(station(d).pause).toMatchObject({ state: "asking", waitFor: ["bia", "caio"] });
    d = apply(serveBeforePause(d, { stationId: "e1" }, T + 33 * MIN));
    const r = callNext(d, { stationId: "e1" }, T + 48 * MIN);
    expect(kinds(r)).toEqual([["attended", "bia"]]);
    d = apply(r);
    // A pausa de 59 min (12:31 a 13:30) agora conta de 12:48.
    expect(station(d).pause).toEqual({
      state: "asking",
      since: T + 48 * MIN,
      askedAt: T + 48 * MIN,
      until: T + 107 * MIN,
      waitFor: ["caio"],
    });
    expect(pauseAnswerTimeouts(d, T + 50 * MIN).events).toEqual([]);
    expect(pauseAnswerTimeouts(d, T + 48 * MIN + PAUSE_ANSWER_MS).events.map((e) => e.itemId)).toEqual([
      "caio",
      undefined,
    ]);
  });

  it("pausar agora: a Bia recebe a justificativa (uma vez) e a estação entra em pausa", () => {
    const r = pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN);
    expect(r.ok && r.events).toEqual([
      {
        kind: "turn_after_pause",
        itemId: "bia",
        entryId: "ent-bia",
        sessionId: "s1",
        stationId: "e1",
        data: { until: T + 90 * MIN, at: T + 32 * MIN, stage: "care", first: true },
      },
      { kind: "station_paused", stationId: "e1", data: { from: T + 31 * MIN, until: T + 90 * MIN } },
    ]);
    const d = apply(r);
    expect(station(d).pause).toEqual({ state: "paused", since: T + 31 * MIN, until: T + 90 * MIN });
    expect(d.heldByPause).toEqual([{ id: "bia", stationId: "e1", since: T + 31 * MIN }]);
  });

  it("a Bia, com a justificativa, vê a pausa antes da vez na estimativa (até a volta)", () => {
    const d = apply(pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN));
    expect(estimate(d, "bia", T + 40 * MIN, AUTO)).toMatchObject({
      kind: "position",
      position: 1,
      pause: { from: T + 31 * MIN, until: T + 90 * MIN, beforeTurn: true },
    });
    expect(estimate(d, "caio", T + 40 * MIN, AUTO)).not.toMatchObject({ pause: { beforeTurn: true } });
  });

  it("sem resposta: a varredura espera 3 min com a estação livre e manda a justificativa, uma vez", () => {
    const d = scene();
    expect(pauseAnswerTimeouts(d, T + 33 * MIN)).toEqual({ day: d, events: [] });
    const sent = pauseAnswerTimeouts(d, T + 31 * MIN + PAUSE_ANSWER_MS);
    expect(sent.events.map((e) => [e.kind, e.itemId ?? null])).toEqual([
      ["turn_after_pause", "bia"],
      ["station_paused", null],
    ]);
    expect(station(sent.day).pause).toMatchObject({ state: "paused", since: T + 31 * MIN });
    expect(sent.day.heldByPause).toEqual([{ id: "bia", stationId: "e1", since: T + 31 * MIN }]);
    expect(pauseAnswerTimeouts(sent.day, T + 40 * MIN).events).toEqual([]);
  });

  it("com paciente ainda em atendimento na hora da pausa, a estação não pergunta", () => {
    let d = present(alreadyNotified(dayWith(["ana", "bia"]), "bia", T - 5 * MIN, 30), "ana");
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    expect(pauseAnswerTimeouts(d, T + 40 * MIN).events).toEqual([]);
    expect(pauseState(station(d))).toBe("scheduled");
  });

  it("ninguém mais esperando (outra estação chamou a Bia): a pausa começa sem justificativa", () => {
    const d = apply(callNext(two(scene()), { stationId: "e2" }, T + 32 * MIN));
    expect(station(d, "e2").calledItemId).toBe("bia");
    const r = pauseAnswerTimeouts(d, T + 40 * MIN);
    expect(r.events).toEqual([]);
    expect(station(r.day).pause).toEqual({ state: "paused", since: T + 31 * MIN, until: T + 90 * MIN });
  });

  it("com outra estação da etapa chamando na hora da pausa, não pergunta: a outra chama a Bia", () => {
    let d = two(present(alreadyNotified(dayWith(["ana", "bia"]), "bia", T - 5 * MIN, 30), "ana"));
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    const r = pauseAnswerTimeouts(d, T + 40 * MIN);
    expect(r.events).toEqual([]);
    expect(pauseState(station(r.day))).toBe("paused");
  });

  it("atender antes respeita quem classifica: o técnico não chama o acolhido, e a pausa começa com justificativa", () => {
    const base = dayWith(["bia"]);
    const d = freeze({
      ...base,
      items: base.items.map((i) => ({ ...i, stage: "triage" as const, state: "present" as const, welcomed: true })),
      stations: [
        {
          id: "t1",
          stage: "triage" as const,
          services: ["cli"],
          open: true,
          calledItemId: null,
          pause: { state: "asking" as const, since: T, askedAt: T, until: T + 60 * MIN, waitFor: ["bia"] },
        },
      ],
    });
    const r = serveBeforePause(d, { stationId: "t1", classifies: false }, T + MIN);
    expect(kinds(r)).toEqual([
      ["turn_after_pause", "bia"],
      ["station_paused", null],
    ]);
    expect(station(apply(r), "t1").pause).toEqual({ state: "paused", since: T, until: T + 60 * MIN });
    expect(apply(r).heldByPause).toEqual([{ id: "bia", stationId: "t1", since: T }]);
  });

  it("atender antes ou pausar agora fora da pergunta é recusado", () => {
    const d = apply(
      pauseStation(
        present(alreadyNotified(dayWith(["ana", "bia"]), "bia", T, 30), "ana"),
        { stationId: "e1", back: null },
        T,
      ),
    );
    // Marcada (ainda não chegou a hora): não há pergunta para responder.
    expect(serveBeforePause(d, { stationId: "e1" }, T + MIN)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(pauseNow(d, { stationId: "e1" }, T + MIN)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("pausar de novo perguntando ou atendendo antes é recusado (desmarque antes)", () => {
    expect(pauseStation(scene(), { stationId: "e1", back: null }, T + 32 * MIN)).toEqual({
      ok: false,
      error: "station_already_paused",
    });
  });

  it("desmarcar perguntando: a estação volta a chamar e a Bia é a próxima", () => {
    let d = apply(resumeStation(scene(), { stationId: "e1" }, T + 32 * MIN));
    expect(station(d).pause).toBeUndefined();
    d = apply(callNext(d, { stationId: "e1" }, T + 33 * MIN));
    expect(station(d).calledItemId).toBe("bia");
  });

  it("desmarcar atendendo antes não registra parada (a estação estava atendendo)", () => {
    const d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    const back = apply(resumeStation(d, { stationId: "e1" }, T + 35 * MIN));
    expect(station(back).pause).toBeUndefined();
    expect(station(back).stops ?? []).toEqual([]);
  });

  it("fechar a estação com alguém esperando antes da pausa: a pessoa recebe a justificativa, sem hora de volta", () => {
    const d = scene();
    const withPausedOther = freeze({
      ...d,
      stations: [
        ...d.stations,
        {
          id: "e2",
          stage: "care" as const,
          services: ["cli"],
          open: true,
          calledItemId: null,
          pause: { state: "paused" as const, since: T, until: null },
        },
      ],
    });
    const r = closeStation(withPausedOther, { stationId: "e1" }, T + 32 * MIN);
    expect(kinds(r)).toEqual([
      ["turn_after_pause", "bia"],
      ["station_closed", null],
    ]);
    expect(r.ok && r.events[0]?.data).toEqual({ until: null, at: T + 32 * MIN, stage: "care", first: true });
  });

  it("fechar com outra estação chamando: quem esperava não recebe a justificativa (a outra o chama)", () => {
    const d = scene();
    const withOther = freeze({
      ...d,
      stations: [
        ...d.stations,
        { id: "e2", stage: "care" as const, services: ["cli"], open: true, calledItemId: null },
      ],
    });
    expect(kinds(closeStation(withOther, { stationId: "e1" }, T + 32 * MIN))).toEqual([["station_closed", null]]);
  });

  it("atendimento antes da pausa que passa da volta marcada: a pausa começa ao finalizar, com a mesma duração", () => {
    const d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
    const r = apply(finish(d, { stationId: "e1" }, T + 100 * MIN));
    expect(station(r).pause).toEqual({ state: "paused", since: T + 100 * MIN, until: T + 159 * MIN });
  });

  it("sem hora de volta: atender antes e finalizar deixa a pausa sem hora de volta", () => {
    let d = present(alreadyNotified(dayWith(["ana", "bia"]), "bia", T - 5 * MIN, 30), "ana");
    d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    d = apply(callNext(d, { stationId: "e1" }, T + 21 * MIN));
    d = apply(finish(d, { stationId: "e1" }, T + 30 * MIN));
    expect(station(d).pause).toMatchObject({ state: "asking", until: null, waitFor: ["bia"] });
    // Ana foi chamada antes da pausa; Bia chegou no prazo e espera.
    d = apply(serveBeforePause(d, { stationId: "e1" }, T + 31 * MIN));
    expect(station(d).pause).toMatchObject({ state: "serving", length: null, waitFor: ["bia"] });
    d = apply(finish(d, { stationId: "e1" }, T + 40 * MIN));
    expect(station(d).pause).toEqual({ state: "paused", since: T + 40 * MIN, until: null });
  });

  it("atendendo antes: quem ainda é esperado não vê a pausa; quem está em casa vê a pausa à frente", () => {
    let d = present(alreadyNotified(dayWith(["ana", "bia", "carlos", "duda"]), "bia", T - 5 * MIN, 30), "ana");
    d = alreadyNotified(d, "carlos", T - 5 * MIN, 30);
    d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 30 } }, T));
    d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
    d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
    d = apply(checkIn(d, { itemId: "carlos" }, T + 21 * MIN));
    d = apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
    d = apply(serveBeforePause(d, { stationId: "e1" }, T + 35 * MIN));
    expect(estimate(d, "carlos", T + 36 * MIN, AUTO)).not.toHaveProperty("pause");
    const duda = estimate(d, "duda", T + 36 * MIN, AUTO);
    expect(duda.kind === "position" && duda.pause?.from).toBeGreaterThanOrEqual(T + 36 * MIN);
  });

  it("no intervalo da sessão, chamar diz que é o intervalo, mesmo perguntando", () => {
    let d = present(dayWith(["bia"], { breaks: [{ start: T + 30 * MIN, end: T + 60 * MIN }] }), "bia");
    d = freeze({
      ...d,
      stations: d.stations.map((e) => ({
        ...e,
        pause: { state: "asking" as const, since: T + 35 * MIN, askedAt: T + 35 * MIN, until: null, waitFor: ["bia"] },
      })),
    });
    expect(callNext(d, { stationId: "e1" }, T + 40 * MIN)).toEqual({ ok: false, error: "session_break" });
    expect(serveBeforePause(d, { stationId: "e1" }, T + 40 * MIN)).toEqual({ ok: false, error: "session_break" });
  });

  describe("revisão 1", () => {
    it("quem chega atrasado (depois do próprio prazo), mesmo antes da hora da pausa, não entra na pergunta", () => {
      let d = present(alreadyNotified(dayWith(["ana", "bia", "caio"]), "bia", T - 5 * MIN, 30), "ana");
      d = alreadyNotified(d, "caio", T, 30); // prazo do Caio: 12:30; o da Bia: 12:25
      d = apply(pauseStation(d, { stationId: "e1", back: null }, T));
      d = apply(callNext(d, { stationId: "e1" }, T + 10 * MIN));
      d = apply(checkIn(d, { itemId: "bia" }, T + 27 * MIN));
      d = apply(finish(d, { stationId: "e1" }, T + 35 * MIN));
      expect(pauseState(station(d))).toBe("paused");
    });

    it("os 3 min contam de quando a pergunta foi vista, não da hora marcada (varredura parada)", () => {
      let d = present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30));
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      const seen = pauseAnswerTimeouts(d, T + 42 * MIN);
      expect(seen.events).toEqual([]);
      expect(station(seen.day).pause).toMatchObject({ state: "asking", since: T + 30 * MIN, askedAt: T + 42 * MIN });
      expect(pauseAnswerTimeouts(seen.day, T + 44 * MIN).events).toEqual([]);
      expect(pauseAnswerTimeouts(seen.day, T + 45 * MIN).events.map((e) => e.kind)).toEqual([
        "turn_after_pause",
        "station_paused",
      ]);
    });

    it("com a unidade sem sinal (modo manual), a varredura não manda a justificativa", () => {
      const d = freeze({ ...scene(), outages: [{ start: T + 31 * MIN, end: null }] });
      expect(pauseAnswerTimeouts(d, T + 40 * MIN).events).toEqual([]);
    });

    it("duas estações perguntando pela mesma pessoa: só a primeira a pausar manda a justificativa", () => {
      let d = two(present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30)));
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(pauseStation(d, { stationId: "e2", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      const first = pauseNow(d, { stationId: "e1" }, T + 31 * MIN);
      expect(kinds(first)).toEqual([
        ["turn_after_pause", "bia"],
        ["station_paused", null],
      ]);
      expect(kinds(pauseNow(apply(first), { stationId: "e2" }, T + 31 * MIN))).toEqual([["station_paused", null]]);
    });

    it("a volta que passou antes de a pergunta ser vista: a pausa acabou, nada de pergunta", () => {
      let d = present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30));
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 5 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      const r = pauseAnswerTimeouts(d, T + 36 * MIN);
      expect(r.events).toEqual([]);
      expect(station(r.day).pause).toBeUndefined();
    });

    it("na triagem, o técnico que acolhe antes de pausar: a pessoa acolhida não segura a pausa", () => {
      const base = dayWith(["bia"]);
      let d: SessionDay = freeze({
        ...base,
        requiresTriage: true,
        items: base.items.map((i) => ({ ...i, stage: "triage" as const, state: "present" as const })),
        stations: [
          {
            id: "t1",
            stage: "triage" as const,
            services: ["cli"],
            open: true,
            calledItemId: null,
            pause: { state: "asking" as const, since: T, askedAt: T, until: T + 60 * MIN, waitFor: ["bia"] },
          },
        ],
      });
      d = apply(serveBeforePause(d, { stationId: "t1", classifies: false }, T + MIN));
      expect(station(d, "t1").calledItemId).toBe("bia");
      d = inRoom(d, "t1");
      d = apply(finish(d, { stationId: "t1", classifies: false }, T + 10 * MIN));
      expect(station(d, "t1").pause).toMatchObject({ state: "paused", since: T + 10 * MIN });
    });
  });

  describe("revisão 2", () => {
    it("tocar 'pausar agora' ou 'atender' de novo, com a estação já em pausa, não é erro", () => {
      const d = apply(pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN));
      expect(pauseNow(d, { stationId: "e1" }, T + 33 * MIN)).toMatchObject({ ok: true, events: [] });
      expect(serveBeforePause(d, { stationId: "e1" }, T + 33 * MIN)).toMatchObject({ ok: true, events: [] });
    });

    it("fechar perguntando: quem recebeu a justificativa vê a pausa antes da vez e não recebe outra", () => {
      let d = two(present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30)));
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(pauseStation(d, { stationId: "e2", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      d = apply(closeStation(d, { stationId: "e1" }, T + 31 * MIN));
      expect(d.heldByPause).toEqual([{ id: "bia", stationId: "e1", since: T + 31 * MIN }]);
      expect(kinds(pauseNow(d, { stationId: "e2" }, T + 32 * MIN))).toEqual([["station_paused", null]]);
    });

    it("quem é chamado deixa de ter a pausa antes da vez", () => {
      let d = apply(pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN));
      d = apply(resumeStation(d, { stationId: "e1" }, T + 40 * MIN));
      d = apply(callNext(d, { stationId: "e1" }, T + 41 * MIN));
      expect(d.heldByPause ?? []).toEqual([]);
    });

    it("antes de a varredura gravar a pergunta, quem a estação vai perguntar já não vê a pausa", () => {
      let d = present(alreadyNotified(dayWith(["bia", "caio"]), "bia", T - 5 * MIN, 30));
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      // Gravado ainda como marcada; às 12:31 a estação já estaria perguntando pela Bia.
      expect(pauseState(station(d))).toBe("scheduled");
      expect(estimate(d, "bia", T + 31 * MIN, AUTO)).not.toHaveProperty("pause");
    });
  });

  describe("revisão 3", () => {
    it("atendendo antes, a pausa na estimativa começa depois do atendimento (pelo tempo médio) e não anda a cada consulta", () => {
      let d = present(alreadyNotified(dayWith(["ana", "bia", "duda"]), "bia", T - 5 * MIN, 30), "ana");
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 30 } }, T));
      d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      d = apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
      d = apply(serveBeforePause(d, { stationId: "e1" }, T + 31 * MIN));
      const p = station(d).pause;
      expect(p?.state === "serving" && p.from).toBeGreaterThan(T + 31 * MIN);
      const at = (t: number) => {
        const e = estimate(d, "duda", t, AUTO);
        return e.kind === "position" ? e.pause : undefined;
      };
      expect(at(T + 32 * MIN)).toEqual(at(T + 35 * MIN));
      expect(at(T + 32 * MIN)?.from).toBeGreaterThan(T + 32 * MIN);
    });

    it("a pausa antes da vez vale só enquanto a estação que pausou está parada", () => {
      let d = apply(pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN));
      d = apply(resumeStation(d, { stationId: "e1" }, T + 40 * MIN));
      // Outra pausa, sem relação: a Bia não a vê como "antes da sua vez".
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 30 } }, T + 41 * MIN));
      expect(estimate(d, "bia", T + 42 * MIN, AUTO)).not.toMatchObject({ pause: { beforeTurn: true } });
    });
  });

  describe("revisão 4", () => {
    it("fechar em pausa: quem tinha a justificativa com hora de volta recebe outra, sem hora", () => {
      let d = apply(pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN));
      // Outra estação aberta (em pausa): fechar esta não encerra a sessão.
      d = freeze({
        ...d,
        stations: [
          ...d.stations,
          {
            id: "e2",
            stage: "care" as const,
            services: ["cli"],
            open: true,
            calledItemId: null,
            pause: { state: "paused" as const, since: T, until: null },
          },
        ],
      });
      const r = closeStation(d, { stationId: "e1" }, T + 40 * MIN);
      expect(kinds(r)).toEqual([
        ["turn_after_pause", "bia"],
        ["station_closed", null],
      ]);
      d = apply(r);
      expect(r.ok && r.events[0]?.data).toMatchObject({ until: null });
      expect(d.heldByPause?.at(-1)).toEqual({ id: "bia", stationId: "e1", since: T + 40 * MIN });
    });

    it("ao fim do atendimento antes, com outra estação chamando, entra em pausa em vez de perguntar", () => {
      let d = present(alreadyNotified(dayWith(["ana", "bia", "caio"]), "bia", T - 5 * MIN, 30), "ana");
      d = alreadyNotified(d, "caio", T - 5 * MIN, 30);
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(callNext(d, { stationId: "e1" }, T + 15 * MIN));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      d = apply(checkIn(d, { itemId: "caio" }, T + 22 * MIN));
      d = apply(callNext(d, { stationId: "e1" }, T + 31 * MIN));
      d = apply(serveBeforePause(d, { stationId: "e1" }, T + 33 * MIN));
      d = two(d);
      d = apply(finish(d, { stationId: "e1" }, T + 48 * MIN));
      expect(pauseState(station(d))).toBe("paused");
    });

    it("outra estação cuja volta já passou (sem a varredura gravar) conta como chamando", () => {
      let d = present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30));
      d = freeze({
        ...d,
        stations: [
          ...d.stations,
          {
            id: "e2",
            stage: "care" as const,
            services: ["cli"],
            open: true,
            calledItemId: null,
            pause: { state: "paused" as const, since: T - 60 * MIN, until: T + 30 * MIN },
          },
        ],
      });
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      expect(pauseState(advancePauses(d, T + 31 * MIN).stations[0] as Station)).toBe("paused");
    });

    it("a volta da estação que segurava passou (sem a varredura gravar): a pausa seguinte não é 'antes da vez'", () => {
      let d = apply(pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN));
      d = freeze({ ...d, breaks: [{ start: T + 95 * MIN, end: T + 120 * MIN }] });
      expect(estimate(d, "bia", T + 91 * MIN, AUTO)).not.toMatchObject({ pause: { beforeTurn: true } });
    });
  });

  describe("revisão 5", () => {
    it("o tempo perguntando vira parada mesmo quando a estação escolhe atender antes", () => {
      const d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 33 * MIN));
      expect(station(d).stops).toContainEqual({ start: T + 31 * MIN, end: T + 33 * MIN });
    });

    it("na triagem, a previsão da consulta usa a pausa de quem atende antes no tempo real, não no início da consulta", () => {
      const base = dayWith(["a1", "a2", "a3", "bia"]);
      const day = (pause?: Station["pause"]): SessionDay =>
        freeze({
          ...base,
          requiresTriage: true,
          items: base.items.map((i) => ({ ...i, stage: "triage" as const, state: "present" as const })),
          stations: [
            { id: "t1", stage: "triage" as const, services: ["cli"], open: true, calledItemId: null },
            {
              id: "e1",
              stage: "care" as const,
              services: ["cli"],
              open: true,
              calledItemId: "x",
              ...(pause ? { pause } : {}),
            },
          ],
        });
      const serving = day({ state: "serving", from: T + MIN, length: 5 * MIN, waitFor: [] });
      // A pausa (12:01 a 12:06) acaba antes de a Bia chegar à consulta: a previsão da consulta não muda.
      expect(estimate(serving, "bia", T, AUTO)).toEqual(estimate(day(), "bia", T, AUTO));
    });

    it("depois de uma queda da unidade, os 3 min para responder recomeçam", () => {
      const out = freeze({ ...scene(), outages: [{ start: T + 32 * MIN, end: null }] });
      const during = pauseAnswerTimeouts(out, T + 40 * MIN);
      const back = freeze({ ...during.day, outages: [{ start: T + 32 * MIN, end: T + 40 * MIN }] });
      expect(pauseAnswerTimeouts(back, T + 41 * MIN).events).toEqual([]);
      expect(pauseAnswerTimeouts(back, T + 43 * MIN).events.length).toBeGreaterThan(0);
    });
  });

  describe("revisão 6", () => {
    it("'pausar agora' com a estação já atendendo antes, ou sem pausa, não é erro (tela velha)", () => {
      const serving = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
      expect(pauseNow(serving, { stationId: "e1" }, T + 32 * MIN)).toMatchObject({ ok: true, events: [] });
      const back = apply(resumeStation(scene(), { stationId: "e1" }, T + 32 * MIN));
      expect(pauseNow(back, { stationId: "e1" }, T + 33 * MIN)).toMatchObject({ ok: true, events: [] });
      expect(serveBeforePause(back, { stationId: "e1" }, T + 33 * MIN)).toMatchObject({ ok: true, events: [] });
    });
  });

  describe("revisão 7", () => {
    it("com duas pessoas na justificativa, nenhuma recebe que é 'a primeira'", () => {
      let d = present(alreadyNotified(dayWith(["bia", "caio"]), "bia", T - 5 * MIN, 30));
      d = alreadyNotified(d, "caio", T - 5 * MIN, 30);
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      d = apply(checkIn(d, { itemId: "caio" }, T + 21 * MIN));
      const r = pauseNow(d, { stationId: "e1" }, T + 31 * MIN);
      const data = r.ok ? r.events.filter((e) => e.kind === "turn_after_pause").map((e) => e.data?.first) : [];
      expect(data).toEqual([false, false]);
      const one = pauseNow(scene(), { stationId: "e1" }, T + 32 * MIN);
      expect(one.ok && one.events[0]?.data?.first).toBe(true);
    });

    it("outra estação com a pausa ainda à frente não conta como chamando: a estação pergunta", () => {
      let d = present(alreadyNotified(dayWith(["bia"]), "bia", T - 5 * MIN, 30));
      d = freeze({
        ...d,
        stations: [
          ...d.stations,
          {
            id: "e2",
            stage: "care" as const,
            services: ["cli"],
            open: true,
            calledItemId: null,
            pause: { state: "scheduled" as const, from: T + 35 * MIN, until: null },
          },
        ],
      });
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      expect(pauseState(advancePauses(d, T + 31 * MIN).stations[0] as Station)).toBe("asking");
    });
  });

  describe("revisão 8", () => {
    it("quem já tem a justificativa de outra estação na frente: o novo não ouve que é 'a primeira'", () => {
      let d = two(present(alreadyNotified(dayWith(["bia", "caio"]), "bia", T - 5 * MIN, 30)));
      d = alreadyNotified(d, "caio", T - 5 * MIN, 30);
      d = apply(pauseStation(d, { stationId: "e1", back: { inMin: 60 } }, T));
      d = apply(pauseStation(d, { stationId: "e2", back: { inMin: 60 } }, T));
      d = apply(checkIn(d, { itemId: "bia" }, T + 20 * MIN));
      d = freeze({
        ...d,
        stations: d.stations.map((e) =>
          e.id === "e1"
            ? {
                ...e,
                pause: {
                  state: "asking" as const,
                  since: T + 30 * MIN,
                  askedAt: T + 30 * MIN,
                  until: T + 90 * MIN,
                  waitFor: ["bia"],
                },
              }
            : e,
        ),
      });
      d = apply(pauseNow(d, { stationId: "e1" }, T + 31 * MIN));
      d = apply(checkIn(d, { itemId: "caio" }, T + 21 * MIN));
      d = freeze({
        ...d,
        stations: d.stations.map((e) =>
          e.id === "e2"
            ? {
                ...e,
                pause: {
                  state: "asking" as const,
                  since: T + 30 * MIN,
                  askedAt: T + 30 * MIN,
                  until: T + 90 * MIN,
                  waitFor: ["bia", "caio"],
                },
              }
            : e,
        ),
      });
      const r = pauseNow(d, { stationId: "e2" }, T + 32 * MIN);
      const sent = r.ok ? r.events.filter((e) => e.kind === "turn_after_pause") : [];
      expect(sent.map((e) => [e.itemId, e.data?.first])).toEqual([["caio", false]]);
    });

    it("fechar a última estação (encerra a sessão) não manda a justificativa", () => {
      const r = closeStation(scene(), { stationId: "e1", confirmed: true }, T + 32 * MIN);
      expect(kinds(r)).toEqual([["station_closed", null]]);
    });

    it("atendendo antes, se a chamada some por outro caminho, o relógio da pausa segue", () => {
      const d = apply(serveBeforePause(scene(), { stationId: "e1" }, T + 31 * MIN));
      const freed = freeze({ ...d, stations: d.stations.map((e) => ({ ...e, calledItemId: null })) });
      expect(pauseState(advancePauses(freed, T + 40 * MIN).stations[0] as Station)).not.toBe("serving");
    });

    it("estação fechada com quem tinha a justificativa: o app segue mostrando a pausa antes da vez, com a volta da outra estação", () => {
      let d = two(scene());
      d = freeze({
        ...d,
        stations: d.stations.map((e) =>
          e.id === "e2" ? { ...e, pause: { state: "paused" as const, since: T, until: T + 120 * MIN } } : e,
        ),
      });
      d = apply(closeStation(d, { stationId: "e1" }, T + 32 * MIN));
      expect(d.heldByPause?.map((h) => h.id)).toEqual(["bia"]);
      const e = estimate(d, "bia", T + 33 * MIN, AUTO);
      expect(e).toMatchObject({ kind: "position", pause: { beforeTurn: true, until: T + 120 * MIN } });
    });
  });

  describe("revisão 9", () => {
    const closingWithOther = () => {
      const d = scene();
      return freeze({
        ...d,
        stations: [
          ...d.stations,
          {
            id: "e2",
            stage: "care" as const,
            services: ["cli"],
            open: true,
            calledItemId: null,
            pause: { state: "paused" as const, since: T, until: T + 120 * MIN },
          },
        ],
      });
    };

    it("fechar com outra estação da etapa em pausa com volta: a justificativa leva a volta dela", () => {
      const r = closeStation(closingWithOther(), { stationId: "e1" }, T + 32 * MIN);
      expect(r.ok && r.events[0]?.data).toMatchObject({ until: T + 120 * MIN });
    });

    it("quando outra estação da etapa volta a chamar, a pausa antes da vez acaba", () => {
      let d = apply(closeStation(closingWithOther(), { stationId: "e1" }, T + 32 * MIN));
      expect(estimate(d, "bia", T + 40 * MIN, AUTO)).toMatchObject({ pause: { beforeTurn: true } });
      d = apply(resumeStation(d, { stationId: "e2" }, T + 50 * MIN));
      expect(estimate(d, "bia", T + 51 * MIN, AUTO)).not.toMatchObject({ pause: { beforeTurn: true } });
    });
  });

  describe("revisão 10", () => {
    const withE2 = (pause: Station["pause"]) => {
      const d = scene();
      return freeze({
        ...d,
        stations: [
          ...d.stations,
          {
            id: "e2",
            stage: "care" as const,
            services: ["cli"],
            open: true,
            calledItemId: null,
            ...(pause ? { pause } : {}),
          },
        ],
      });
    };

    it("outra estação chamando, com a pausa dela ainda à frente: 'pausar agora' não manda justificativa", () => {
      const d = withE2({ state: "scheduled", from: T + 60 * MIN, until: null });
      expect(kinds(pauseNow(d, { stationId: "e1" }, T + 32 * MIN))).toEqual([["station_paused", null]]);
    });

    it("a justificativa leva a primeira volta da etapa, como o app mostra", () => {
      const d = withE2({ state: "paused", since: T, until: T + 60 * MIN });
      const r = pauseNow(d, { stationId: "e1" }, T + 32 * MIN);
      expect(r.ok && r.events[0]?.data).toMatchObject({ until: T + 60 * MIN });
      expect(estimate(apply(r), "bia", T + 33 * MIN, AUTO)).toMatchObject({ pause: { until: T + 60 * MIN } });
    });
  });
});
