import { describe, expect, it } from "vitest";
import {
  callNext,
  closeStation,
  finish,
  noShow,
  recall,
  showedUp,
  showedUpAt,
  toleranceExceeded,
  undoShowedUp,
} from "../src/call.ts";
import { checkIn, DEFAULT_CONFIG, eligible, leaving, type SessionDay, type Station } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { alreadyNotified, dayWith, freeze, inRoom, withItem } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);

function apply(r: Result<SessionDay>): SessionDay {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return freeze(r.state);
}

const item = (day: SessionDay, id: string) => {
  const i = day.items.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
};
const station = (day: SessionDay, id: string) => {
  const e = day.stations.find((x) => x.id === id);
  if (!e) throw new Error(`estação ${id} não existe`);
  return e;
};
const order = (day: SessionDay, stationId = "e1"): string[] => eligible(day, stationId).map((i) => i.id);
const enter = (day: SessionDay, id: string, now = T) => apply(checkIn(day, { itemId: id }, now));
const call = (day: SessionDay, stationId = "e1", now = T) =>
  apply(callNext(inRoom(day, stationId), { stationId }, now));
const skip = (day: SessionDay, stationId = "e1", now = T) => apply(noShow(day, { stationId }, now));
const calledAt = (day: SessionDay, stationId = "e1") => station(day, stationId).calledItemId;

const stationOf = (id: string, stage: Station["stage"]): Station => ({
  id,
  stage,
  services: ["cli"],
  open: true,
  calledItemId: null,
});

/** Serviço com triagem: estação "t1" de triagem e "e1" de atendimento; todos começam na triagem. */
function dayWithTriage(ids: string[]): SessionDay {
  let d = dayWith(ids, { stations: [stationOf("e1", "care"), stationOf("t1", "triage")] });
  for (const id of ids) d = withItem(d, id, { stage: "triage" });
  return d;
}

/** Nenhum elegível vem antes de alguém que ainda o trava (a ordem nunca precisou do recurso sem travas). */
function respectsLocks(day: SessionDay, stationId = "e1"): void {
  const o = order(day, stationId);
  for (const [after, id] of o.entries()) {
    const x = item(day, id);
    if (x.confirmedUrgency) continue;
    for (const t of x.lockedBehind) {
      if (o.includes(t)) expect(o.indexOf(t), `${id} passou à frente de ${t}`).toBeLessThan(after);
    }
  }
}

describe("RN-CHAM-01/02: chamar, encerrar a chamada anterior", () => {
  it("RN-CHAM-01/02 call: next closes previous and skips remote", () => {
    let d = dayWith(["ana", "joao", "bruno"]);
    d = enter(d, "joao");
    d = enter(d, "bruno");
    const r = callNext(d, { stationId: "e1" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = freeze(r.state);
    expect(item(d, "joao").state).toBe("called"); // Ana (nº 1) está remota
    expect(calledAt(d)).toBe("joao");
    expect(d.calls).toEqual([{ itemId: "joao", stage: "care", stationId: "e1", at: T + MIN }]);
    expect(r.events).toEqual([
      {
        kind: "called",
        itemId: "joao",
        entryId: "ent-joao",
        stationId: "e1",
        sessionId: "s1",
        data: { ticket: "C002", stage: "care", at: T + MIN },
      },
    ]);
    const r2 = callNext(d, { stationId: "e1" }, T + 2 * MIN);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    d = freeze(r2.state);
    expect(item(d, "joao")).toMatchObject({ state: "done_in_stage", attendedInStages: ["care"] });
    expect(item(d, "bruno").state).toBe("called");
    expect(r2.events.map((e) => e.kind)).toEqual(["attended", "called"]);
    expect(r2.events[0]).toMatchObject({ itemId: "joao", data: { stage: "care", nextStage: null } });
    // RN-CHAM-01 (2026-11-12): sem elegível, o chamado anterior é finalizado e a estação fica livre.
    const r3 = callNext(d, { stationId: "e1" }, T + 3 * MIN);
    d = apply(r3);
    expect(r3.ok && r3.events.map((e) => e.kind)).toEqual(["attended"]);
    expect(item(d, "bruno").state).toBe("done_in_stage");
    expect(calledAt(d, "e1")).toBeNull();
    expect(item(d, "ana").state).toBe("remote");
    // Sem chamado aberto e sem elegível: aí sim o erro, sem mudar nada.
    expect(callNext(d, { stationId: "e1" }, T + 4 * MIN)).toEqual({ ok: false, error: "none_eligible" });
  });

  it("RN-CHAM-02: Finalizar encerra o atendimento atual sem chamar outro", () => {
    let d = dayWith(["ana", "joao"]);
    d = enter(d, "ana");
    d = enter(d, "joao");
    d = call(d);
    const r = finish(d, { stationId: "e1" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.state, "ana").state).toBe("done_in_stage");
    expect(item(r.state, "joao").state).toBe("present");
    expect(calledAt(r.state)).toBeNull();
    expect(r.events.map((e) => e.kind)).toEqual(["attended"]);
    // Sem ninguém chamado, não há o que finalizar.
    expect(finish(freeze(r.state), { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("RN-CHAM-02: Rechamar repete o anúncio sem reiniciar a tolerância", () => {
    let d = enter(dayWith(["ana"]), "ana");
    d = call(d, "e1", T);
    const r = recall(d, { stationId: "e1" }, T + 3 * MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // A chamada guarda o horário da rechamada para a TV anunciar de novo; o horário da chamada não muda.
    expect(r.state).toEqual({
      ...d,
      calls: d.calls.map((c) => (c.itemId === "ana" ? { ...c, recalls: [T + 3 * MIN] } : c)),
    });
    expect(r.events).toEqual([
      {
        kind: "recalled",
        itemId: "ana",
        entryId: "ent-ana",
        stationId: "e1",
        sessionId: "s1",
        data: { ticket: "C001", at: T + 3 * MIN },
      },
    ]);
    expect(toleranceExceeded(freeze(r.state), "e1", T + 5 * MIN)).toBe(true);
    expect(recall(dayWith(["ana"]), { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("RN-CHAM-01: chamar só com a sessão aberta", () => {
    const d = enter(dayWith(["ana"]), "ana");
    expect(callNext(freeze({ ...d, state: "closed" }), { stationId: "e1" }, T)).toEqual({
      ok: false,
      error: "session_closed",
    });
  });
});

describe("Review Focus 2: ninguém elegível ou nenhuma estação aberta", () => {
  it("RN-CHAM-01: sem elegível, chamarProximo devolve nenhum_elegivel sem mudar nada", () => {
    const d = dayWith(["ana", "joao"]); // todos remotos
    expect(callNext(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "none_eligible" });
    const present = enter(d, "ana");
    const closed = freeze({ ...present, stations: [{ ...station(present, "e1"), open: false }] });
    expect(callNext(closed, { stationId: "e1" }, T)).toEqual({ ok: false, error: "none_eligible" });
    expect(callNext(present, { stationId: "nao_existe" }, T)).toEqual({ ok: false, error: "none_eligible" });
  });
});

describe("Review Focus 4: duas estações chamando no mesmo estado", () => {
  it("RN-CHAM-01/INV-04: a 2ª chamada sobre o estado devolvido pela 1ª pega outro paciente", () => {
    let d = dayWith(["ana", "joao", "bruno"], {
      stations: [stationOf("e1", "care"), stationOf("e2", "care")],
    });
    for (const id of ["ana", "joao", "bruno"]) d = enter(d, id);
    const d1 = call(d, "e1", T + MIN);
    const d2 = call(d1, "e2", T + MIN);
    expect(calledAt(d2, "e1")).toBe("ana");
    expect(calledAt(d2, "e2")).toBe("joao");
    expect(item(d2, "ana").state).toBe("called");
    expect(item(d2, "joao").state).toBe("called");
    expect(order(d2)).toEqual(["bruno"]);
  });
});

describe("RN-CHAM-03 e AD-006: Não compareceu, tolerância", () => {
  it("RN-CHAM-03 call: three skips", () => {
    let d = dayWith(["ana", "joao", "bruno"]);
    for (const id of ["ana", "joao", "bruno"]) d = enter(d, id);
    d = call(d, "e1", T + MIN); // Ana
    const r1 = noShow(d, { stationId: "e1" }, T + 6 * MIN); // 1º pulo
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    d = freeze(r1.state);
    expect(item(d, "ana")).toMatchObject({ state: "present", skips: 1, number: 1 });
    expect(calledAt(d)).toBeNull();
    expect(r1.events.map((e) => e.kind)).toEqual(["skipped"]);
    expect(r1.events[0]).toMatchObject({ itemId: "ana", stationId: "e1", data: { skips: 1, for: "present" } });
    expect(order(d)).toEqual(["joao", "ana", "bruno"]);
    d = call(d, "e1", T + 7 * MIN); // João
    d = call(d, "e1", T + 8 * MIN); // Ana de novo
    expect(item(d, "ana").state).toBe("called");
    d = skip(d, "e1", T + 14 * MIN); // 2º pulo
    expect(item(d, "ana")).toMatchObject({ state: "remote", skips: 2 });
    d = enter(d, "ana", T + 20 * MIN);
    d = call(d, "e1", T + 21 * MIN); // Bruno
    expect(calledAt(d)).toBe("bruno");
    d = call(d, "e1", T + 22 * MIN); // Ana
    expect(calledAt(d)).toBe("ana");
    const r3 = noShow(d, { stationId: "e1" }, T + 28 * MIN); // 3º pulo
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(item(r3.state, "ana")).toMatchObject({ state: "left_queue", skips: 3 });
    expect(r3.events.map((e) => e.kind)).toEqual(["skipped", "no_show", "left_queue"]);
    expect(r3.events[1]).toMatchObject({ itemId: "ana", entryId: "ent-ana", reason: "não compareceu à chamada" });
    expect(order(freeze(r3.state))).toEqual([]);
  });

  it("RN-CHAM-03: 1º pulo não aplica atraso; chamadas feitas com a pessoa presente não contam", () => {
    let d = dayWith(["ana", "joao"]);
    d = enter(d, "joao");
    d = enter(d, "ana"); // Ana (nº 1) fica atrás de João (janela)
    d = call(d, "e1", T + MIN); // João, que vem depois de Ana em ordem, é chamado com Ana na sala
    d = call(d, "e1", T + 2 * MIN); // Ana
    d = skip(d, "e1", T + 8 * MIN);
    expect(item(d, "ana")).toMatchObject({ state: "present", number: 1, skips: 1 });
    expect(d.nextNumber).toBe(3);
  });

  it("RN-CHAM-03: 2º pulo devolve a remoto marcando a saída; ao voltar só contam as chamadas feitas fora", () => {
    const upToTwoSkips = () => {
      let d = dayWith(["ana", "joao", "bruno"]);
      for (const id of ["ana", "joao", "bruno"]) d = enter(d, id);
      d = call(d, "e1", T + MIN); // Ana
      d = skip(d, "e1", T + 2 * MIN);
      d = call(d, "e1", T + 3 * MIN); // João (vem depois de Ana), chamado com Ana na sala
      d = call(d, "e1", T + 4 * MIN); // Ana
      d = skip(d, "e1", T + 10 * MIN);
      expect(item(d, "ana").leftAt).toBe(T + 10 * MIN);
      return d;
    };
    // Volta sem que ninguém depois dela tenha sido chamado enquanto estava fora: mantém o número.
    expect(item(enter(upToTwoSkips(), "ana", T + 20 * MIN), "ana").number).toBe(1);
    // Bruno (depois dela) chamado enquanto ela estava fora: a vez passou.
    let d = alreadyNotified(upToTwoSkips(), "ana", T + 10 * MIN, 1); // "venha agora" logo depois do 2º pulo
    d = call(d, "e1", T + 12 * MIN); // Bruno
    d = enter(d, "ana", T + 20 * MIN);
    expect(item(d, "ana").number).toBe(4);
  });

  it("RN-CHAM-03: 3 pulos somam as etapas", () => {
    let d = dayWithTriage(["ana", "joao"]);
    d = enter(d, "ana");
    d = enter(d, "joao");
    d = call(d, "t1", T + MIN); // Ana na triagem
    d = skip(d, "t1", T + 7 * MIN); // 1º pulo, na triagem
    expect(item(d, "ana")).toMatchObject({ stage: "triage", state: "present", skips: 1 });
    d = call(d, "t1", T + 8 * MIN); // João
    d = call(d, "t1", T + 9 * MIN); // Ana
    d = apply(finish(inRoom(d, "t1"), { stationId: "t1" }, T + 12 * MIN)); // Ana triada
    expect(item(d, "ana")).toMatchObject({ stage: "care", state: "present", skips: 1 });
    d = call(d, "e1", T + 13 * MIN); // João (triado antes, na sala do consultório antes dela)
    d = call(d, "e1", T + 14 * MIN); // Ana no consultório
    expect(calledAt(d)).toBe("ana");
    d = skip(d, "e1", T + 19 * MIN); // 2º pulo: 1 na triagem, 1 no consultório
    expect(item(d, "ana")).toMatchObject({ state: "remote", skips: 2 });
    d = enter(d, "ana", T + 25 * MIN);
    d = call(d, "e1", T + 26 * MIN);
    expect(calledAt(d)).toBe("ana");
    const r = noShow(d, { stationId: "e1" }, T + 32 * MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.state, "ana")).toMatchObject({ state: "left_queue", skips: 3 });
    expect(r.events.map((e) => e.kind)).toContain("no_show");
  });

  it("RN-CHAM-03: Não compareceu só com alguém chamado na estação", () => {
    const d = enter(dayWith(["ana"]), "ana");
    expect(noShow(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("AD-006/RN-EST-05 call: tolerance never skips on its own", () => {
    let d = dayWith(["ana", "joao"]);
    d = enter(d, "ana");
    d = enter(d, "joao");
    d = call(d, "e1", T); // Ana entra no consultório
    expect(toleranceExceeded(d, "e1", T + 12 * MIN)).toBe(true); // consulta longa
    expect(item(d, "ana")).toMatchObject({ state: "called", skips: 0 });
    d = call(d, "e1", T + 12 * MIN);
    expect(calledAt(d)).toBe("joao");
    expect(item(d, "ana").state).toBe("done_in_stage");
    expect(toleranceExceeded(d, "e1", T + 18 * MIN)).toBe(true);
    expect(item(d, "joao").skips).toBe(0);
    d = skip(d, "e1", T + 18 * MIN); // "Não compareceu"
    expect(item(d, "joao")).toMatchObject({ state: "present", skips: 1 });
  });

  it("AD-006 clock: advancing re-evaluates tolerance", () => {
    let d = enter(dayWith(["ana", "joao"]), "ana");
    expect(toleranceExceeded(d, "e1", T + 10 * MIN)).toBe(false); // ninguém chamado
    d = call(d, "e1", T);
    expect(toleranceExceeded(d, "e1", T + 4 * MIN)).toBe(false);
    expect(toleranceExceeded(d, "e1", T + 5 * MIN - 1)).toBe(false); // lado de dentro
    expect(toleranceExceeded(d, "e1", T + 5 * MIN)).toBe(true); // lado de fora
    expect(item(d, "ana")).toMatchObject({ state: "called", skips: 0 }); // ninguém é pulado sozinho
    const config = { ...DEFAULT_CONFIG, toleranceMin: 10 };
    expect(toleranceExceeded(freeze({ ...d, config }), "e1", T + 5 * MIN)).toBe(false);
  });
});

describe("RN-EST-05: estação", () => {
  it("RN-EST-05 station: cannot close while someone is called", () => {
    let d = enter(dayWith(["ana"]), "ana");
    d = call(d);
    expect(closeStation(d, { stationId: "e1" })).toEqual({ ok: false, error: "station_has_call" });
    expect(station(d, "e1").open).toBe(true);
    d = apply(finish(d, { stationId: "e1" }, T + MIN));
    const r = closeStation(d, { stationId: "e1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(station(r.state, "e1").open).toBe(false);
    expect(closeStation(d, { stationId: "nao_existe" })).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("RN-EST-05 station: a call from another session is not dropped", () => {
    // A estação e1 tem chamado aberto de outra sessão (item que não está nesta).
    let d = dayWith(["bia"], {
      stations: [{ ...stationOf("e1", "care"), calledItemId: "s0-ana" }],
    });
    d = enter(d, "bia");
    expect(callNext(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "station_busy" });
    expect(finish(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(noShow(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(calledAt(d)).toBe("s0-ana");
    expect(closeStation(d, { stationId: "e1" })).toEqual({ ok: false, error: "station_has_call" });
  });
});

describe("RN-TRI: triagem", () => {
  it("RN-TRI-01/04 triage: two stages with the same ticket", () => {
    let d = dayWithTriage(["ana", "joao"]);
    d = enter(d, "ana");
    d = enter(d, "joao");
    // O consultório não chama antes da triagem.
    expect(callNext(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "none_eligible" });
    d = call(d, "t1", T + MIN);
    expect(calledAt(d, "t1")).toBe("ana");
    const r = callNext(inRoom(d, "t1"), { stationId: "t1" }, T + 5 * MIN); // fecha a triagem da Ana e chama João
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = freeze(r.state);
    expect(item(d, "ana")).toMatchObject({
      stage: "care",
      state: "present",
      ticket: "C001",
      number: 3, // RN-TRI-04 (2026-11-13): número novo na fila do atendimento
      attendedInStages: ["triage"],
    });
    expect(r.events[0]).toMatchObject({ kind: "attended", data: { stage: "triage", nextStage: "care" } });
    expect(item(d, "joao").state).toBe("called");
    d = apply(finish(inRoom(d, "t1"), { stationId: "t1" }, T + 9 * MIN)); // João triado
    expect(item(d, "joao")).toMatchObject({ stage: "care", state: "present" });
    expect(order(d)).toEqual(["ana", "joao"]);
    d = call(d, "e1", T + 10 * MIN);
    expect(calledAt(d)).toBe("ana");
    expect(item(d, "joao")).toMatchObject({ number: 4, ticket: "C002" }); // RN-TRI-04 (2026-11-13): número novo, mesma senha

    // Janela protegida dentro da triagem.
    let w = dayWithTriage(["ana", "joao"]);
    w = enter(w, "joao");
    w = enter(w, "ana"); // número melhor, mas João já estava na sala
    expect(calledAt(call(w, "t1"), "t1")).toBe("joao");

    // Chamadas da triagem não fazem ninguém perder a vez no consultório.
    let x = dayWithTriage(["ana", "joao"]);
    x = enter(x, "ana");
    x = enter(x, "joao");
    x = call(x, "t1", T + MIN); // Ana
    x = apply(finish(inRoom(x, "t1"), { stationId: "t1" }, T + 2 * MIN));
    x = apply(leaving(x, { itemId: "ana" }, T + 3 * MIN)); // Ana em casa, já no consultório
    x = call(x, "t1", T + 4 * MIN); // João chamado na triagem
    x = enter(x, "ana", T + 5 * MIN);
    expect(item(x, "ana").number).toBe(3); // o número que ganhou ao sair da triagem; não perdeu a vez
  });

  it("RN-TRI-04 (2026-11-13): o atendimento é uma fila nova; quem sai da triagem entra atrás de quem já estava, no seu nível de risco", () => {
    let d = dayWithTriage(["ana", "joao", "bia"]);
    d = enter(d, "joao");
    d = enter(d, "ana"); // Ana atrás de João na triagem (janela)
    d = call(d, "t1", T + MIN); // João
    d = call(d, "t1", T + 2 * MIN); // João triado (entra no atendimento); Ana chamada na triagem
    d = apply(finish(inRoom(d, "t1"), { stationId: "t1" }, T + 4 * MIN)); // Ana triada
    // Ana tinha o número 1, mas no atendimento chegou depois de João: número novo, sem travas.
    expect(item(d, "ana")).toMatchObject({ stage: "care", state: "present", number: 5, lockedBehind: [] });
    expect(item(d, "joao").number).toBe(4);
    expect(d.nextNumber).toBe(6);
    d = call(d, "e1", T + 5 * MIN);
    expect(calledAt(d, "e1")).toBe("joao");
  });
});

describe("Review Focus 3: sair e voltar com pulos no meio", () => {
  it("RN-PRES-02/C34 order: leaving and coming back never deadlocks (2º pulo)", () => {
    let d = dayWith(["ana", "joao", "bruno"]);
    for (const id of ["ana", "joao", "bruno"]) d = enter(d, id);
    d = call(d, "e1", T + MIN); // Ana
    d = skip(d, "e1", T + 2 * MIN); // 1º pulo: Ana atrás de João
    respectsLocks(d);
    d = call(d, "e1", T + 3 * MIN); // João
    d = call(d, "e1", T + 4 * MIN); // Ana
    d = skip(d, "e1", T + 5 * MIN); // 2º pulo: Ana em casa
    d = enter(d, "ana", T + 6 * MIN);
    expect(order(d)).toEqual(["bruno", "ana"]);
    respectsLocks(d);
    d = call(d, "e1", T + 7 * MIN);
    expect(calledAt(d)).toBe("bruno");
  });
});

describe("pureza", () => {
  it("ações de chamada não alteram o estado recebido (entrada congelada em profundidade)", () => {
    let d = dayWith(["ana", "joao"]);
    d = enter(d, "ana");
    d = enter(d, "joao");
    const called = call(d);
    const before = structuredClone(called);
    callNext(called, { stationId: "e1" }, T);
    recall(called, { stationId: "e1" }, T);
    finish(called, { stationId: "e1" }, T);
    noShow(called, { stationId: "e1" }, T);
    closeStation(called, { stationId: "e1" });
    closeStation(d, { stationId: "e1" });
    toleranceExceeded(called, "e1", T);
    const oneSkip = withItem(called, "ana", { skips: 1 });
    noShow(oneSkip, { stationId: "e1" }, T);
    noShow(withItem(called, "ana", { skips: 2 }), { stationId: "e1" }, T);
    expect(called).toEqual(before);
  });
});

describe("RN-TRI-03/04: classificação confirmada na triagem", () => {
  /** Ana e João já triados e presentes no atendimento; Caio chamado na triagem. */
  function caioInTriage(): SessionDay {
    let d = dayWithTriage(["ana", "joao", "caio", "duda"]);
    d = withItem(d, "ana", { stage: "care", state: "present", attendedInStages: ["triage"] });
    d = withItem(d, "joao", { stage: "care", state: "present", attendedInStages: ["triage"] });
    d = enter(d, "caio");
    return call(d, "t1", T + MIN);
  }

  it("RN-TRI-03/04: urgência confirmada na triagem é a 1ª do atendimento", () => {
    const r = finish(inRoom(caioInTriage(), "t1"), { stationId: "t1", confirmedRisk: "urgent" }, T + 5 * MIN);
    const d = apply(r);
    expect(item(d, "caio")).toMatchObject({ stage: "care", risk: "urgent", confirmedUrgency: true });
    expect(order(d)).toEqual(["caio", "ana", "joao"]);
    // A API grava entrada.riscoConfirmado (INV-07: só agendador ou triagem).
    expect(r.ok && r.events).toContainEqual({
      kind: "risk_confirmed",
      itemId: "caio",
      entryId: "ent-caio",
      stationId: "t1",
      sessionId: "s1",
      data: { level: "urgent", stage: "triage" },
    });
  });

  it("AD-058: Manchester — laranja (muito urgente) confirmado passa à frente do amarelo confirmado", () => {
    let d = caioInTriage();
    d = withItem(d, "ana", { risk: "urgent", confirmedUrgency: true });
    const r = finish(inRoom(d, "t1"), { stationId: "t1", confirmedRisk: "very_urgent" }, T + 5 * MIN);
    const after = apply(r);
    expect(item(after, "caio")).toMatchObject({ risk: "very_urgent", confirmedUrgency: true });
    expect(order(after)).toEqual(["caio", "ana", "joao"]);
  });

  it("RN-TRI-03: chamar o próximo também confirma ou reclassifica quem sai da triagem", () => {
    let d = caioInTriage();
    d = withItem(d, "caio", { risk: "attention" });
    d = enter(d, "duda", T + 2 * MIN);
    d = apply(callNext(inRoom(d, "t1"), { stationId: "t1", confirmedRisk: "routine" }, T + 5 * MIN));
    expect(item(d, "caio")).toMatchObject({ stage: "care", risk: "routine", confirmedUrgency: false });
    expect(order(d)).toEqual(["ana", "joao", "caio"]);
  });

  it("AD-059: vermelho na triagem vai para o 1º lugar do atendimento, à frente até do laranja", () => {
    let d = caioInTriage();
    d = withItem(d, "ana", { risk: "very_urgent", confirmedUrgency: true });
    const r = finish(inRoom(d, "t1"), { stationId: "t1", confirmedRisk: "emergency" }, T + 5 * MIN);
    const after = apply(r);
    expect(item(after, "caio")).toMatchObject({ stage: "care", risk: "emergency", confirmedUrgency: true });
    expect(order(after)).toEqual(["caio", "ana", "joao"]);
    expect(r.ok && r.events.map((e) => e.kind)).toEqual(["attended", "risk_confirmed"]);
  });

  it("AD-059: encaminhar à emergência é explícito: atendido na triagem, sai da fila desta unidade", () => {
    const r = finish(
      inRoom(caioInTriage(), "t1"),
      { stationId: "t1", confirmedRisk: "emergency", refer: true },
      T + 5 * MIN,
    );
    const d = apply(r);
    expect(item(d, "caio")).toMatchObject({ stage: "triage", state: "done_in_stage" });
    expect(order(d)).toEqual(["ana", "joao"]);
    expect(r.ok && r.events.map((e) => e.kind)).toEqual(["attended", "referred_to_emergency"]);
    const viaCall = apply(
      callNext(inRoom(caioInTriage(), "t1"), { stationId: "t1", confirmedRisk: "emergency", refer: true }, T + 5 * MIN),
    );
    expect(item(viaCall, "caio").state).toBe("done_in_stage");
    // Encaminhar só com vermelho.
    expect(finish(inRoom(caioInTriage(), "t1"), { stationId: "t1", confirmedRisk: "urgent", refer: true }, T)).toEqual({
      ok: false,
      error: "forbidden_transition",
    });
  });

  it("RN-TRI-03: só a triagem confirma; sem confirmação, nada muda", () => {
    const d = caioInTriage();
    const inOffice = call(apply(finish(inRoom(d, "t1"), { stationId: "t1" }, T + 5 * MIN)), "e1", T + 6 * MIN);
    expect(finish(inOffice, { stationId: "e1", confirmedRisk: "urgent" }, T + 7 * MIN)).toEqual({
      ok: false,
      error: "forbidden_transition",
    });
    expect(item(apply(finish(inRoom(d, "t1"), { stationId: "t1" }, T + 5 * MIN)), "caio").risk).toBe("routine");
  });
});

describe("m5: estação com a sessão aberta", () => {
  it("m5/RN-EST-05: fechar estação só com a sessão aberta, como as ações vizinhas", () => {
    for (const state of ["planned", "closed", "cancelled"] as const) {
      expect(closeStation({ ...dayWith(["ana"]), state }, { stationId: "e1" })).toEqual({
        ok: false,
        error: "session_closed",
      });
    }
  });
});

describe("presenteDesde nas chamadas", () => {
  it("da triagem ao atendimento a espera recomeça", () => {
    let d = dayWithTriage(["ana", "joao"]);
    d = enter(d, "ana");
    d = call(d, "t1", T + MIN);
    d = apply(finish(inRoom(d, "t1"), { stationId: "t1" }, T + 5 * MIN));
    expect(item(d, "ana")).toMatchObject({ stage: "care", state: "present", presentSince: T + 5 * MIN });
  });

  it("o 1º pulo (fica presente) recomeça a contar; o 2º (vai a remoto) apaga", () => {
    let d = enter(dayWith(["ana"]), "ana");
    d = call(d, "e1", T + MIN);
    d = skip(d, "e1", T + 3 * MIN);
    expect(item(d, "ana")).toMatchObject({ state: "present", presentSince: T + 3 * MIN });
    d = call(d, "e1", T + 4 * MIN);
    d = skip(d, "e1", T + 6 * MIN);
    expect(item(d, "ana")).toMatchObject({ state: "remote", presentSince: null });
  });
});

describe("Compareceu: a pessoa entrou na sala", () => {
  const came = (day: SessionDay, stationId = "e1", now = T) => apply(showedUp(day, { stationId }, now));
  const last = (day: SessionDay) => day.calls[day.calls.length - 1];

  it("grava a hora na última chamada; repetir não muda", () => {
    let d = call(enter(dayWith(["ana"]), "ana"));
    expect(showedUpAt(d, "e1")).toBeNull();
    const r = showedUp(d, { stationId: "e1" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.map((e) => e.kind)).toEqual(["showed_up"]);
    d = freeze(r.state);
    expect(last(d)?.showedUpAt).toBe(T + MIN);
    expect(showedUpAt(d, "e1")).toBe(T + MIN);
    const again = showedUp(d, { stationId: "e1" }, T + 2 * MIN);
    expect(again.ok && again.state).toBe(d);
    expect(again.ok && again.events).toEqual([]);
  });

  it("sem ninguém chamado, recusa; sessão fechada, recusa", () => {
    const d = enter(dayWith(["ana"]), "ana");
    expect(showedUp(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(undoShowedUp(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    const closed = { ...call(d), state: "closed" as const };
    expect(showedUp(closed, { stationId: "e1" }, T)).toEqual({ ok: false, error: "session_closed" });
  });

  it("desfazer volta à fase de chamado; sem Compareceu, recusa", () => {
    let d = call(enter(dayWith(["ana"]), "ana"));
    expect(undoShowedUp(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    d = apply(undoShowedUp(came(d), { stationId: "e1" }, T + MIN));
    expect(showedUpAt(d, "e1")).toBeNull();
    expect(last(d)?.showedUpAt).toBeUndefined();
  });

  it("depois do Compareceu, rechamar e não compareceu recusam e a tolerância não vale", () => {
    const d = came(call(enter(dayWith(["ana"]), "ana")));
    expect(recall(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(noShow(d, { stationId: "e1" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(toleranceExceeded(d, "e1", T + 60 * MIN)).toBe(false);
  });

  it("triagem: fechar o chamado sem Compareceu recusa; com Compareceu segue", () => {
    let d = call(enter(dayWithTriage(["ana", "joao"]), "ana"), "t1");
    d = enter(d, "joao");
    expect(finish(d, { stationId: "t1", confirmedRisk: "urgent" }, T)).toEqual({
      ok: false,
      error: "no_show_up",
    });
    expect(callNext(d, { stationId: "t1", confirmedRisk: "urgent" }, T)).toEqual({
      ok: false,
      error: "no_show_up",
    });
    d = apply(finish(came(d, "t1"), { stationId: "t1", confirmedRisk: "urgent" }, T + MIN));
    expect(item(d, "ana").stage).toBe("care");
  });

  it("atendimento: fechar sem Compareceu marca o comparecimento sozinho", () => {
    const d = call(enter(dayWith(["ana"]), "ana"));
    const r = finish(d, { stationId: "e1" }, T + 3 * MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(last(r.state)?.showedUpAt).toBe(T + 3 * MIN);
  });

  it("Review Focus 1: chamado de novo depois do 1º pulo começa sem Compareceu", () => {
    let d = call(enter(dayWith(["ana"]), "ana"));
    d = skip(d);
    d = call(d, "e1", T + MIN);
    expect(calledAt(d)).toBe("ana");
    expect(showedUpAt(d, "e1")).toBeNull();
  });
});
