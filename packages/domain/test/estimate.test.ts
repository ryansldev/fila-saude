import { describe, expect, it } from "vitest";
import { callNext, finish, noShow } from "../src/call.ts";
import { averageTime, comeNowNotices, estimate, leaveHomeNotices } from "../src/estimate.ts";
import { checkIn, DEFAULT_CONFIG, leaving, type SessionDay, type Station } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { alreadyNotified, dayWith, freeze, inRoom, queueItem, withItem } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);
const AUTO = { manualMode: false };
const MANUAL = { manualMode: true };

function apply(r: Result<SessionDay>): SessionDay {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return freeze(r.state);
}
const enter = (day: SessionDay, id: string) => apply(checkIn(day, { itemId: id }, T));
const call = (day: SessionDay, stationId = "e1") => apply(callNext(inRoom(day, stationId), { stationId }, T));
const station = (id: string, stage: Station["stage"], open = true): Station => ({
  id,
  stage,
  services: ["cli"],
  open,
  calledItemId: null,
});
const close = (day: SessionDay): SessionDay =>
  freeze({ ...day, stations: day.stations.map((e) => ({ ...e, open: false })) });
const oneMore = (day: SessionDay): SessionDay => freeze({ ...day, stations: [...day.stations, station("e2", "care")] });

/** Ana, João, Bruno e Dora (risco urgente: vem antes dos outros de mesmo nível). */
const four = (): SessionDay => withItem(dayWith(["ana", "joao", "bruno", "dora"]), "dora", { risk: "urgent" });

describe("RN-ETA-01/01b/04: posição e tempo", () => {
  it("RN-ETA-01 queue: eta and position (remoto conta presentes e remotos à frente)", () => {
    let d = four(); // ordem: dora, ana, joao, bruno
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
    expect(estimate(d, "bruno", T, AUTO)).toEqual({ kind: "position", position: 4, minutes: 45 });
    d = oneMore(d); // 3 à frente × 15 ÷ 2 = 22,5 → 23
    expect(estimate(d, "bruno", T, AUTO)).toEqual({ kind: "position", position: 4, minutes: 23 });
  });

  it("RN-ETA-01b eta: present patient sees real call order (janela protegida)", () => {
    let d = four();
    d = enter(d, "joao");
    d = enter(d, "ana"); // ordem melhor que João, mas fica atrás dele (K=1)
    expect(estimate(d, "joao", T, AUTO)).toEqual({ kind: "position", position: 1, minutes: 0 });
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
    d = oneMore(d);
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "position", position: 2, minutes: 8 });
    // Remoto continua com RN-ETA-01: Dora, Ana e João à frente, presentes e remotos.
    expect(estimate(d, "bruno", T, AUTO)).toEqual({ kind: "position", position: 4, minutes: 23 });
  });

  it("RN-ETA-04/AD-003 eta: remote first sees come now; present first never does", () => {
    let d = dayWith(["ana", "joao", "dora"]);
    d = withItem(d, "dora", { risk: "urgent" });
    expect(estimate(d, "dora", T, AUTO)).toEqual({ kind: "come_now" });
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
    expect(estimate(close(d), "dora", T, AUTO)).toEqual({ kind: "awaiting_start" });
    d = enter(d, "dora");
    expect(estimate(d, "dora", T, AUTO)).toEqual({ kind: "position", position: 1, minutes: 0 });
  });

  const triageDay = (): SessionDay => {
    const d = dayWith(["ana", "joao"], {
      stations: [station("tri", "triage"), station("e1", "care")],
      initialTimeMin: { triage: 5 },
    });
    return freeze({ ...d, items: d.items.map((i) => ({ ...i, stage: "triage" as const })) });
  };

  it("RN-ETA-01c/AD-009 triage: eta sums both stages (tempo até a triagem, consulta à parte)", () => {
    const tri = triageDay();
    // 1 à frente × 5 min na triagem; consulta: 5 + 1 à frente × 15 min.
    expect(estimate(tri, "joao", T, AUTO)).toEqual({
      kind: "position",
      position: 2,
      minutes: 5,
      query: { minutes: 20 },
    });
    // Ana é a 1ª da triagem: venha agora, e a consulta dela segue à parte (0 + 0 à frente).
    expect(estimate(tri, "ana", T, AUTO)).toEqual({ kind: "come_now", query: { minutes: 0 } });
    // Triagem fechada: sem tempo.
    const closed = freeze({
      ...tri,
      stations: tri.stations.map((e) => (e.stage === "triage" ? { ...e, open: false } : e)),
    });
    expect(estimate(closed, "joao", T, AUTO)).toEqual({ kind: "awaiting_start" });
  });

  it("RN-ETA-01c/AD-009 triage: a consulta conta quem já foi triado; remoto 1º na triagem vê venha agora com consulta", () => {
    let d = enter(triageDay(), "ana");
    d = call(d, "tri");
    d = apply(finish(inRoom(d, "tri"), { stationId: "tri" }, T)); // Ana triada, presente no consultório
    expect(estimate(d, "joao", T, AUTO)).toEqual({ kind: "come_now", query: { minutes: 15 } });
  });

  it("RN-ETA-01c/AD-009 triage: presente ainda não triado vê posição, tempo e consulta", () => {
    let d = enter(triageDay(), "ana");
    d = enter(d, "joao");
    expect(estimate(d, "joao", T, AUTO)).toEqual({
      kind: "position",
      position: 2,
      minutes: 5,
      query: { minutes: 20 },
    });
  });
});

describe("RN-ETA-02: sem estação aberta", () => {
  it("RN-ETA-02: sem estação aberta → aguardando início (remoto e presente)", () => {
    let d = four();
    d = enter(d, "joao");
    const stopped = close(d);
    expect(estimate(stopped, "joao", T, AUTO)).toEqual({ kind: "awaiting_start" });
    expect(estimate(stopped, "bruno", T, AUTO)).toEqual({ kind: "awaiting_start" });
    expect(estimate(stopped, "dora", T, AUTO)).toEqual({ kind: "awaiting_start" });
  });

  it("RN-ETA-02: estação aberta de outra etapa não conta; estação fechada na etapa fica aguardando", () => {
    const d = dayWith(["ana", "joao"], { stations: [station("e1", "care", false), station("tri", "triage")] });
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "awaiting_start" });
  });
});

describe("RN-ETA-03/AD-009: saia de casa", () => {
  const notified = (events: { itemId?: string }[]) => events.map((e) => e.itemId);

  it("RN-ETA-03 queue: leave home notice once", () => {
    let d = four(); // dora 0, ana 15, joao 30, bruno 45
    const a1 = leaveHomeNotices(d, T, AUTO);
    expect(a1.events.every((e) => e.kind === "leave_home")).toBe(true);
    expect(notified(a1.events).sort()).toEqual(["ana", "dora"]); // 30 min exatos não é "abaixo"
    d = freeze(a1.day);
    expect(leaveHomeNotices(d, T, AUTO).events).toEqual([]);

    d = enter(d, "dora");
    d = call(d);
    const a2 = leaveHomeNotices(d, T, AUTO);
    expect(notified(a2.events)).toEqual(["joao"]); // 1 à frente (Ana) = 15 min
    expect(leaveHomeNotices(freeze(a2.day), T, AUTO).events).toEqual([]);
  });

  it("RN-ETA-03: o limite é da unidade e vale 'abaixo de'", () => {
    const d = dayWith(["ana", "joao", "bruno"], { config: { ...DEFAULT_CONFIG, leaveHomeMin: 31 } });
    expect(notified(leaveHomeNotices(d, T, AUTO).events)).toEqual(["ana", "joao", "bruno"]);
  });

  it("RN-ETA-03: só remoto recebe; presente não, e sem estação aberta ninguém", () => {
    let d = dayWith(["ana", "joao"]);
    d = enter(d, "ana");
    expect(notified(leaveHomeNotices(d, T, AUTO).events)).toEqual(["joao"]);
    expect(leaveHomeNotices(close(dayWith(["ana"])), T, AUTO).events).toEqual([]);
  });

  it("RN-ETA-03 triage: leave home notice per stage (um por item e etapa)", () => {
    let d = dayWith(["ana", "joao"], {
      stations: [station("tri", "triage"), station("e1", "care")],
      config: { ...DEFAULT_CONFIG, leaveHomeMin: 10 },
      initialTimeMin: { triage: 5 },
    });
    d = freeze({ ...d, items: d.items.map((i) => ({ ...i, stage: "triage" as const })) });
    const a1 = leaveHomeNotices(d, T, AUTO);
    expect(a1.events.map((e) => [e.itemId, e.data?.stage])).toEqual([
      ["ana", "triage"],
      ["joao", "triage"],
    ]); // João: ~5 min na triagem (a soma daria 20)
    d = freeze(a1.day);
    d = enter(enter(d, "ana"), "joao");
    d = call(d, "tri"); // Ana na triagem
    d = call(d, "tri"); // João na triagem; Ana triada, presente no atendimento
    d = apply(finish(inRoom(d, "tri"), { stationId: "tri" }, T)); // João triado
    d = apply(leaving(d, { itemId: "joao" }, T)); // fila do consultório: vai para casa
    // 1 à frente (Ana) × 15 min > 10: nada.
    expect(leaveHomeNotices(d, T, AUTO).events).toEqual([]);
    d = call(d, "e1"); // Ana entra no consultório
    const a2 = leaveHomeNotices(d, T, AUTO);
    expect(a2.events.map((e) => [e.itemId, e.data?.stage])).toEqual([["joao", "care"]]);
    expect(leaveHomeNotices(freeze(a2.day), T, AUTO).events).toEqual([]);
  });
});

describe("RN-SES-05: modo manual", () => {
  it("RN-SES-05: modo manual não avisa e não estima", () => {
    const d = four();
    expect(estimate(d, "dora", T, MANUAL)).toEqual({ kind: "manual_mode" });
    expect(estimate(d, "bruno", T, MANUAL)).toEqual({ kind: "manual_mode" });
    const r = leaveHomeNotices(d, T, MANUAL);
    expect(r.events).toEqual([]);
    expect(r.day).toBe(d);
    // Ao voltar o sinal, quem não foi avisado ainda é avisado.
    expect(leaveHomeNotices(d, T, AUTO).events.length).toBeGreaterThan(0);
  });
});

describe("RN-ETA-05: tempo médio", () => {
  /** Chamadas na estação e1 com os intervalos dados (min) entre elas; a última não tem duração. */
  function withIntervals(gaps: number[], partial: Partial<SessionDay> = {}): SessionDay {
    let at = T;
    const times = [at, ...gaps.map((g) => (at += g * MIN))];
    const items = times.map((_, k) => queueItem(`x${k}`, k + 1));
    return dayWith([], {
      items,
      calls: times.map((t, k) => ({ itemId: `x${k}`, stage: "care" as const, stationId: "e1", at: t })),
      ...partial,
    });
  }
  const end = T + 24 * 60 * MIN;

  it("RN-ETA-05: menos de 3 atendimentos válidos usa o tempo inicial (e o da unidade)", () => {
    expect(averageTime(dayWith(["a"]), "care", "cli", end)).toBe(15);
    expect(averageTime(withIntervals([10, 10]), "care", "cli", end)).toBe(15); // 2 < 3
    expect(averageTime(withIntervals([10, 10, 10]), "care", "cli", end)).toBe(10);
    const d = dayWith([], { config: { ...DEFAULT_CONFIG, initialAverageTimeMin: 20 } });
    expect(averageTime(d, "care", "cli", end)).toBe(20);
    expect(averageTime(dayWith([], { initialTimeMin: { triage: 5 } }), "triage", "cli", end)).toBe(5);
    expect(averageTime(dayWith([]), "care", "outro", end)).toBe(15);
  });

  it("RN-ETA-05: média dos últimos 10, a última chamada da estação não entra", () => {
    // 12 durações: as 2 mais antigas (20, não fora da curva) ficam fora da janela; a última chamada não é duração.
    // Com a janela: 10 de 10 min = 10. Sem a janela: (2 x 20 + 10 x 10) / 12 = 11,67.
    const gaps = [20, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    expect(averageTime(withIntervals(gaps), "care", "cli", end)).toBe(10);
  });

  it("RN-ETA-05: descarta fora da curva (< 1/3 ou > 3× a mediana)", () => {
    const gaps = [10, 10, 10, 10, 10, 10, 10, 10, 2, 40]; // mediana 10: 2 < 3,33 e 40 > 30 saem
    expect(averageTime(withIntervals(gaps), "care", "cli", end)).toBe(10);
    // 30 min exatos (3×) não é "fora".
    const border = [10, 10, 10, 10, 10, 10, 10, 10, 30, 10];
    expect(averageTime(withIntervals(border), "care", "cli", end)).toBe(12);
  });

  it("RN-ETA-05: o limite inferior é 1/3 da mediana, inclusive (10/3 min não é fora da curva)", () => {
    // mediana 10; 10/3 min = 200 s exatos fica; (10/3 - 1/60) sai.
    const inside = withIntervals([10, 10, 10, 10, 10, 10, 10, 10 / 3, 10, 10]);
    expect(averageTime(inside, "care", "cli", end)).toBeCloseTo((9 * 10 + 10 / 3) / 10, 9);
    const outside = withIntervals([10, 10, 10, 10, 10, 10, 10, 10 / 3 - 1 / 60, 10, 10]);
    expect(averageTime(outside, "care", "cli", end)).toBe(10);
  });

  it("RN-ETA-05: o tempo médio calculado alimenta a estimativa", () => {
    const d = withIntervals([10, 10, 10, 10]);
    const day = freeze({
      ...d,
      items: [
        ...d.items.map((i) => ({ ...i, state: "done_in_stage" as const })),
        queueItem("a", 100),
        queueItem("b", 101),
        queueItem("c", 102),
      ],
    });
    expect(estimate(day, "c", end, AUTO)).toEqual({ kind: "position", position: 3, minutes: 20 });
  });

  it("RN-ETA-05: durações por estação, só da etapa pedida", () => {
    const d = dayWith([], {
      stations: [station("e1", "care"), station("e2", "care")],
      items: [1, 2, 3, 4, 5, 6].map((n) => queueItem(`x${n}`, n)),
      calls: [
        { itemId: "x1", stage: "care", stationId: "e1", at: T },
        { itemId: "x2", stage: "care", stationId: "e2", at: T + 1 * MIN },
        { itemId: "x3", stage: "care", stationId: "e1", at: T + 20 * MIN },
        { itemId: "x4", stage: "care", stationId: "e2", at: T + 21 * MIN },
        { itemId: "x5", stage: "care", stationId: "e1", at: T + 40 * MIN },
        { itemId: "x6", stage: "triage", stationId: "tri", at: T + 41 * MIN },
      ],
    });
    // e1: 20, 20 (última não entra); e2: 20 (última não entra) → 3 válidas = 20.
    expect(averageTime(d, "care", "cli", end)).toBe(20);
  });
});

describe("I4: estimativa só para quem espera na sessão aberta", () => {
  it('RN-ETA-01/RN-CHAM-02: chamado vê "chamado", não uma posição', () => {
    const d = call(enter(four(), "ana"));
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "called" });
    expect(estimate(d, "ana", T, MANUAL)).toEqual({ kind: "called" });
  });

  it("RN-ETA-01: atendido, fora da fila ou remanejado: fora da fila", () => {
    const d = apply(finish(call(enter(four(), "ana")), { stationId: "e1" }, T + MIN));
    expect(estimate(d, "ana", T, AUTO)).toEqual({ kind: "out_of_queue" });
    for (const state of ["left_queue", "reassigned"] as const) {
      expect(estimate(withItem(four(), "bruno", { state }), "bruno", T, AUTO)).toEqual({ kind: "out_of_queue" });
    }
  });

  it("RN-SES-05: sessão planejada aguarda o início; encerrada ou cancelada, fora da fila", () => {
    expect(estimate(freeze({ ...four(), state: "planned" as const }), "ana", T, AUTO)).toEqual({
      kind: "awaiting_start",
    });
    for (const state of ["closed", "cancelled"] as const) {
      expect(estimate(freeze({ ...four(), state }), "ana", T, AUTO)).toEqual({ kind: "out_of_queue" });
    }
  });
});

describe("RN-ETA-06/AD-057: prazo de chegada depois do 'venha agora'", () => {
  const DEADLINE = DEFAULT_CONFIG.arrivalDeadlineMin * MIN;
  const notify = (day: SessionDay, at: number) => comeNowNotices(day, at, AUTO);
  const checkInAt = (day: SessionDay, id: string, at: number) => checkIn(day, { itemId: id }, at);
  const callAt = (day: SessionDay, at: number) => apply(callNext(day, { stationId: "e1" }, at));
  const lost = (r: ReturnType<typeof checkIn>) => {
    if (!r.ok) throw new Error(r.error);
    return r.events.find((e) => e.kind === "present")?.data?.lostTurn;
  };

  it("registra o 'venha agora' uma vez, com a hora, e avisa só quem é o próximo", () => {
    const a1 = notify(dayWith(["ana", "bruno"]), T);
    expect(a1.events).toEqual([
      expect.objectContaining({ kind: "come_now", itemId: "ana", data: { stage: "care", at: T, deadlineMin: 30 } }),
    ]);
    expect(a1.day.comeNow).toEqual([{ itemId: "ana", stage: "care", at: T }]);
    expect(notify(freeze(a1.day), T + MIN).events).toEqual([]);
  });

  it("fila parada: quem não chega no prazo deixa de travar a estimativa do próximo", () => {
    const d = freeze(notify(dayWith(["ana", "bruno"]), T).day);
    expect(estimate(d, "bruno", T + DEADLINE - 1, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
    expect(estimate(d, "bruno", T + DEADLINE, AUTO)).toEqual({ kind: "come_now" });
    const a2 = notify(d, T + DEADLINE);
    expect(a2.events.map((e) => e.itemId)).toEqual(["bruno"]);
    // AD-076: Ana perdeu a vez pelo prazo, mesmo sem ninguém chamado: vai para o fim.
    expect(estimate(freeze(a2.day), "ana", T + DEADLINE, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
  });

  it("dentro do prazo, chamar quem vem depois não tira a vez de quem está a caminho", () => {
    let d = freeze(notify(dayWith(["ana", "pedro"]), T).day);
    d = apply(checkInAt(d, "pedro", T));
    d = callAt(d, T + DEADLINE - MIN);
    const r = checkInAt(d, "ana", T + DEADLINE - 1);
    expect(lost(r)).toBe(false);
  });

  it("depois do prazo, perde a vez (AD-076)", () => {
    let d = freeze(notify(dayWith(["ana", "pedro"]), T).day);
    d = apply(checkInAt(d, "pedro", T));
    d = callAt(d, T + DEADLINE);
    expect(lost(checkInAt(d, "ana", T + DEADLINE + MIN))).toBe(true);
  });

  it("antes do 'venha agora', ninguém perde a vez (o 10º não cai porque o balcão andou)", () => {
    // Ana #1 e Bia #2 remotas; Pedro #3 entra pelo balcão e é chamado antes de qualquer aviso.
    let d = apply(checkInAt(dayWith(["ana", "bia", "pedro"]), "pedro", T));
    d = callAt(d, T + MIN);
    expect(lost(checkInAt(d, "bia", T + 30 * MIN))).toBe(false);
    expect(estimate(d, "bia", T + 30 * MIN, AUTO)).toEqual({ kind: "position", position: 2, minutes: 15 });
  });

  it("'Vou sair' recomeça o prazo no próximo 'venha agora'", () => {
    let d = freeze(notify(dayWith(["ana", "bruno"]), T).day);
    d = apply(checkInAt(d, "ana", T + MIN));
    d = apply(leaving(d, { itemId: "ana" }, T + 30 * MIN));
    const a = notify(d, T + 31 * MIN);
    expect(a.events.map((e) => [e.itemId, e.data?.at])).toEqual([["ana", T + 31 * MIN]]);
    expect(a.day.comeNow).toEqual([{ itemId: "ana", stage: "care", at: T + 31 * MIN }]);
  });

  it("modo manual não registra nem avisa", () => {
    const d = dayWith(["ana"]);
    const r = comeNowNotices(d, T, MANUAL);
    expect(r.events).toEqual([]);
    expect(r.day).toBe(d);
  });
});

describe("revisão 2026-11-13: estimativa honesta", () => {
  it("remoto cuja vez já passou não recebe 'venha agora' nem 'saia de casa' como se fosse o próximo", () => {
    // Ana #1 remota; Bruno #2 e Carla #3 presentes; Bruno é chamado: a vez de Ana passou (AD-010).
    let d = alreadyNotified(dayWith(["ana", "bruno", "carla"]), "ana");
    d = enter(d, "bruno");
    d = enter(d, "carla");
    d = call(d);
    const e = estimate(d, "ana", T, AUTO);
    expect(e.kind).toBe("position");
    // Ela vai para o fim: Carla presente vem antes.
    expect(e).toMatchObject({ position: 2 });
    expect(leaveHomeNotices(d, T, AUTO).events.filter((x) => x.itemId === "ana")).toEqual([
      expect.objectContaining({ kind: "leave_home" }),
    ]);
  });

  it("RN-ETA-05: chamada que terminou em 'não compareceu' não conta como atendimento no tempo médio", () => {
    let d = dayWith(["a", "b", "c", "d", "e", "f", "g"]);
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) d = enter(d, id);
    let t = T;
    const step = (min: number, skip: boolean) => {
      d = apply(callNext(d, { stationId: "e1" }, t));
      if (skip) d = apply(noShow(d, { stationId: "e1" }, t + min * MIN));
      t += min * MIN;
    };
    // atendimentos de 20 min intercalados com pulos de 5 min (a mediana não filtra os pulos)
    step(20, false);
    step(5, true);
    step(20, false);
    step(5, true);
    step(20, false);
    step(5, true);
    d = apply(callNext(d, { stationId: "e1" }, t));
    expect(averageTime(d, "care", "cli", t)).toBe(20);
  });
});

describe("RV7: em casa, a posição usa as vagas dos idosos, como a chamada (AD-075)", () => {
  const g = (x: string[]) => ({ groups: x as never, verified: false, verifiedAt: null });
  const pos = (d: ReturnType<typeof dayWith>, id: string) => {
    const e = estimate(d, id, T, AUTO);
    return e.kind === "position" ? e.position : e.kind;
  };

  it("o 80+ fica com a primeira vaga de idoso; a gestante não sai do lugar", () => {
    let d = dayWith(["bia", "gil", "ana"]);
    d = withItem(d, "bia", { priority: g(["elderly"]) });
    d = withItem(d, "gil", { priority: g(["pregnant"]) });
    d = withItem(d, "ana", { priority: g(["elderly80"]) });
    expect(pos(d, "ana")).toBe("come_now");
    expect(pos(d, "gil")).toBe(2);
    expect(pos(d, "bia")).toBe(3);
  });

  it("o 80+ já chamado continua com a vaga: a Bia (70) em casa fica no lugar que era dele", () => {
    let d = dayWith(["bia", "gil", "ana"]);
    d = withItem(d, "bia", { priority: g(["elderly"]) });
    d = withItem(d, "gil", { priority: g(["pregnant"]) });
    d = withItem(d, "ana", { priority: g(["elderly80"]), state: "called" });
    d = { ...d, calls: [{ itemId: "ana", stage: "care", stationId: "e1", at: T }] };
    expect(pos(d, "gil")).toBe("come_now");
    expect(pos(d, "bia")).toBe(2);
  });

  it("o idoso de 60-79 que também é de outro grupo fica no lugar da senha (AD-075)", () => {
    let d = dayWith(["bia", "ana"]);
    d = withItem(d, "bia", { priority: g(["elderly", "disability"]) });
    d = withItem(d, "ana", { priority: g(["elderly80"]) });
    expect(pos(d, "bia")).toBe("come_now");
    expect(pos(d, "ana")).toBe(2);
  });
});
