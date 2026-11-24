import { describe, expect, it } from "vitest";
import { callNext } from "../src/call.ts";
import * as domain from "../src/index.ts";
import {
  checkIn,
  DEFAULT_CONFIG,
  eligible,
  givePriority,
  leaving,
  markAttendanceWithoutApp,
  type QueueItem,
  type SessionDay,
  stayEligible,
  verifyAndMark,
} from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { alreadyNotified, call, dayWith, freeze, withItem } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);

/** Estado de uma ação que deveria dar certo (também congela o resultado, para a próxima ação). */
function apply(r: Result<SessionDay>): SessionDay {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return freeze(r.state);
}

const order = (day: SessionDay): string[] => eligible(day, "e1").map((i) => i.id);
const item = (day: SessionDay, id: string) => {
  const i = day.items.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
};
const enter = (day: SessionDay, id: string, now = T) => apply(checkIn(day, { itemId: id }, now));
const leave = (day: SessionDay, id: string, now = T) => apply(leaving(day, { itemId: id }, now));

/**
 * A ordem respeita toda trava viva: ninguém vem antes de quem ainda o trava. Se o recurso
 * "sem candidato livre" de ordemDeChamada disparasse (ciclo de travas), isto falharia.
 */
function respectsLocks(day: SessionDay): void {
  const o = order(day);
  for (const [after, id] of o.entries()) {
    const x = item(day, id);
    if (x.confirmedUrgency) continue;
    for (const t of x.lockedBehind) {
      if (o.includes(t)) expect(o.indexOf(t), `${id} passou à frente de ${t}`).toBeLessThan(after);
    }
  }
}

describe("janela protegida e atraso (portados do protótipo)", () => {
  it("order: RN-ORD-01 protected window", () => {
    let d = dayWith(["ana", "joao"]); // Ana tem posição melhor
    d = enter(d, "joao");
    expect(order(d)).toEqual(["joao"]);
    d = enter(d, "ana");
    expect(order(d)).toEqual(["joao", "ana"]);
    d = call(d, "joao", T + MIN);
    expect(order(d)).toEqual(["ana"]);
  });

  it("order: RN-ORD-03 consecutive check-ins", () => {
    let d = dayWith(["bruno", "ana", "joao"]);
    d = enter(d, "joao");
    d = enter(d, "ana");
    expect(order(d)).toEqual(["joao", "ana"]);
    d = enter(d, "bruno");
    expect(order(d)).toEqual(["joao", "bruno", "ana"]);
  });

  it("order: RN-ORD-04 late arrival (perdeu o prazo do 'venha agora', AD-076)", () => {
    let d = alreadyNotified(dayWith(["bruno", "ana", "joao"]), "bruno");
    d = enter(d, "ana");
    d = enter(d, "joao");
    expect(order(d)[0]).toBe("ana");
    d = call(d, "ana", T + MIN);
    d = enter(d, "bruno", T + 2 * MIN);
    expect(item(d, "bruno").number).toBe(4);
    expect(d.nextNumber).toBe(5);
    expect(order(d)).toEqual(["joao", "bruno"]);
  });

  it("order: confirmed urgency jumps window", () => {
    let d = dayWith(["ana", "joao", "bruno"]);
    d = enter(d, "ana");
    d = enter(d, "joao");
    d = withItem(d, "bruno", { confirmedUrgency: true, risk: "urgent" });
    d = enter(d, "bruno");
    expect(item(d, "bruno").lockedBehind).toEqual([]);
    expect(order(d)).toEqual(["bruno", "ana", "joao"]);
    // Urgente confirmado também não perde a vez, mesmo com alguém depois dele já chamado.
    let u = dayWith(["ana", "bruno", "edu"]);
    u = withItem(u, "bruno", { confirmedUrgency: true, risk: "urgent" });
    u = withItem(u, "edu", { confirmedUrgency: true, risk: "urgent", state: "present" });
    u = call(u, "edu", T);
    u = enter(u, "bruno", T + MIN);
    expect(item(u, "bruno").number).toBe(2);
  });

  it("order: leaving and coming back never deadlocks", () => {
    let d = dayWith(["ana", "joao", "bruno"]);
    d = enter(d, "ana");
    d = enter(d, "joao"); // João fica atrás de Ana (janela protegida)
    expect(item(d, "joao").lockedBehind).toEqual(["ana"]);
    d = leave(d, "ana", T + MIN);
    expect(order(d)).toEqual(["joao"]);
    d = enter(d, "ana", T + 2 * MIN); // Ana volta: agora fica atrás de João
    expect(order(d)).toEqual(["joao", "ana"]);
    expect(item(d, "ana").number).toBe(1);
  });

  it("order: coming back loses the turn only if the arrival deadline passed (AD-076)", () => {
    let d = dayWith(["ana", "joao", "bruno"]);
    for (const p of ["ana", "joao", "bruno"]) d = enter(d, p);
    d = leave(d, "ana", T + MIN);
    d = withItem(d, "bruno", { confirmedUrgency: true, risk: "urgent" });
    expect(order(d)[0]).toBe("bruno");
    d = call(d, "bruno", T + 2 * MIN); // número maior, mas vinha antes por ser urgente
    d = enter(d, "ana", T + 3 * MIN);
    expect(item(d, "ana").number).toBe(1); // não perdeu a vez
    d = alreadyNotified(leave(d, "ana", T + 4 * MIN), "ana", T + 4 * MIN, 1);
    expect(order(d)[0]).toBe("joao");
    d = call(d, "joao", T + 5 * MIN); // o prazo dela (1 min) já acabou: a vez passou
    d = enter(d, "ana", T + 6 * MIN);
    expect(item(d, "ana").number).toBe(4);
  });

  it("leave: calls made while present do not cost the turn on return", () => {
    let d = dayWith(["joao", "ana"], { config: { ...DEFAULT_CONFIG, windowK: 0 } });
    d = enter(d, "joao");
    d = enter(d, "ana");
    d = call(d, "joao", T + MIN); // João (nº 1) chamado com Ana na sala
    d = withItem(d, "joao", { state: "done_in_stage", attendedInStages: ["care"] });
    d = withItem(d, "ana", { risk: "attention" }); // agora Ana viria antes dele
    d = leave(d, "ana", T + 6 * MIN);
    d = enter(d, "ana", T + 26 * MIN);
    expect(item(d, "ana").number).toBe(2); // manteve o lugar, como o app prometeu
  });
});

describe("ficarElegivel: atraso opcional", () => {
  it("RN-CHAM-03/RN-TRI-04: sem aplicarAtraso, mantém o número mesmo com a vez passada", () => {
    let d = alreadyNotified(dayWith(["ana", "joao"]), "ana");
    d = enter(d, "joao");
    d = call(d, "joao", T + MIN); // João vem depois de Ana em ordem
    const without = stayEligible(d, "ana", T + 2 * MIN, { applyDelay: false });
    expect(item(without.state, "ana")).toMatchObject({ state: "present", number: 1, leftAt: null });
    expect(without.state.nextNumber).toBe(3);
    expect(without.events[0]?.data).toMatchObject({ number: 1, lostTurn: false });
    const withValue = stayEligible(d, "ana", T + 2 * MIN, { applyDelay: true });
    expect(item(withValue.state, "ana").number).toBe(3);
  });
});

describe("RN-PRES: presença", () => {
  it("RN-PRES-01: check-in marca presente e emite o evento", () => {
    const r = checkIn(dayWith(["ana"]), { itemId: "ana" }, T);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.state, "ana").state).toBe("present");
    expect(r.events.map((e) => e.kind)).toContain("present");
  });

  it("RN-PRES-01: check-in só com a sessão aberta e só de quem está remoto", () => {
    expect(checkIn(dayWith(["ana"], { state: "planned" }), { itemId: "ana" }, T)).toEqual({
      ok: false,
      error: "session_closed",
    });
    const d = enter(dayWith(["ana"]), "ana");
    expect(checkIn(d, { itemId: "ana" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(checkIn(d, { itemId: "nao_existe" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it('RN-PRES-02: "Vou sair" volta a remoto mantendo o número; só de quem está presente', () => {
    let d = enter(dayWith(["ana", "joao"]), "ana");
    const r = leaving(d, { itemId: "ana" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = freeze(r.state);
    expect(item(d, "ana")).toMatchObject({ state: "remote", number: 1, leftAt: T + MIN });
    expect(r.events.map((e) => e.kind)).toEqual(["left"]);
    expect(leaving(d, { itemId: "ana" }, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("RN-PRES-03: recepção marca presença de quem não tem pendência; com pendência, recusa", () => {
    const d = markAttendanceWithoutApp(dayWith(["ana"]), { itemId: "ana" }, T);
    expect(d.ok && item(d.state, "ana").state).toBe("present");
    const withPendingCheck = withItem(dayWith(["ana"]), "ana", { pendingChecks: ["pre_registration"] });
    expect(markAttendanceWithoutApp(withPendingCheck, { itemId: "ana" }, T)).toEqual({
      ok: false,
      error: "pending_check",
    });
  });
});

describe("RN-FILA-05: conferência antes de entrar na fila presencial", () => {
  it("RN-FILA-05: check-in com pendência é recusado e o item segue remoto", () => {
    for (const p of ["account", "attended_person", "pre_registration", "priority"] as const) {
      const d = withItem(dayWith(["ana"]), "ana", { pendingChecks: [p] });
      expect(checkIn(d, { itemId: "ana" }, T)).toEqual({ ok: false, error: "pending_check" });
      expect(item(d, "ana").state).toBe("remote");
    }
    // Prioridade declarada e não conferida é pendência, mesmo sem estar na lista.
    const declared = withItem(dayWith(["ana"]), "ana", {
      priority: { groups: ["pregnant"], verified: false, verifiedAt: null },
    });
    expect(checkIn(declared, { itemId: "ana" }, T)).toEqual({ ok: false, error: "pending_check" });
    // Conferida e vencida também (lado de fora); conferida no prazo entra (lado de dentro).
    const DAY = 86_400_000;
    const expires = (verifiedAt: number) =>
      withItem(dayWith(["ana"], { config: { ...DEFAULT_CONFIG, priorityDeadlines: { pregnant: 30 } } }), "ana", {
        priority: { groups: ["pregnant"], verified: true, verifiedAt },
      });
    expect(checkIn(expires(T - 30 * DAY), { itemId: "ana" }, T)).toEqual({ ok: false, error: "pending_check" });
    expect(checkIn(expires(T - 30 * DAY + 1), { itemId: "ana" }, T).ok).toBe(true);
  });

  it("RN-FILA-05: recepção confere e marca presença; atraso conta a partir daí", () => {
    // Ana com conta nova: recusada no QR, conferida no balcão, entra respeitando a janela.
    let a = dayWith(["ana", "joao"]);
    a = withItem(a, "ana", { pendingChecks: ["account"] });
    a = enter(a, "joao");
    expect(checkIn(a, { itemId: "ana" }, T).ok).toBe(false);
    const r = verifyAndMark(a, { itemId: "ana", result: "matches" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    a = freeze(r.state);
    expect(item(a, "ana")).toMatchObject({ state: "present", pendingChecks: [], number: 1 });
    expect(r.events.map((e) => e.kind)).toEqual(["pending_check_resolved", "present"]);
    expect(order(a)).toEqual(["joao", "ana"]);

    // Pedro foi embora depois da recusa; voltou e já chamaram quem vinha depois dele.
    let p = alreadyNotified(dayWith(["pedro", "ana", "joao"]), "pedro");
    p = withItem(p, "pedro", { pendingChecks: ["pre_registration"] });
    p = enter(p, "ana");
    p = enter(p, "joao");
    expect(checkIn(p, { itemId: "pedro" }, T)).toEqual({ ok: false, error: "pending_check" });
    p = call(p, "ana", T + MIN);
    p = apply(verifyAndMark(p, { itemId: "pedro", result: "matches" }, T + 3 * 60 * MIN));
    expect(item(p, "pedro").number).toBe(4);
    expect(order(p)).toEqual(["joao", "pedro"]);
  });

  it("RN-FILA-05: confere também confirma a prioridade declarada", () => {
    let d = withItem(dayWith(["ana"]), "ana", {
      pendingChecks: ["priority"],
      priority: { groups: ["pregnant"], verified: false, verifiedAt: null },
    });
    d = apply(verifyAndMark(d, { itemId: "ana", result: "matches" }, T));
    expect(item(d, "ana").priority).toEqual({ groups: ["pregnant"], verified: true, verifiedAt: T });
  });

  it("RN-FILA-05: recepção recusa identidade → saiu_da_fila sem falta", () => {
    const d = withItem(dayWith(["ana", "joao"]), "ana", { pendingChecks: ["account"] });
    const r = verifyAndMark(d, { itemId: "ana", result: "does_not_match", reason: "documento de outra pessoa" }, T);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.state, "ana").state).toBe("left_queue");
    expect(r.events).toEqual([
      { kind: "not_verified", itemId: "ana", entryId: "ent-ana", reason: "documento de outra pessoa" },
    ]);
    expect(r.events.some((e) => e.kind === "no_show")).toBe(false);
    expect(order(r.state)).toEqual([]);
    // Só de quem está remoto.
    const present = enter(dayWith(["ana"]), "ana");
    expect(verifyAndMark(present, { itemId: "ana", result: "does_not_match" }, T)).toEqual({
      ok: false,
      error: "forbidden_transition",
    });
  });

  it("RN-FILA-05: prioridade não conferida é retirada e a pessoa entra sem ela", () => {
    let d = dayWith(["joao", "ana"], { config: { ...DEFAULT_CONFIG, windowK: 0 } });
    d = withItem(d, "ana", {
      pendingChecks: ["priority"],
      priority: { groups: ["disability"], verified: false, verifiedAt: null },
    });
    d = enter(d, "joao");
    const r = verifyAndMark(d, { itemId: "ana", result: "priority_does_not_match" }, T);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = freeze(r.state);
    expect(item(d, "ana")).toMatchObject({
      state: "present",
      pendingChecks: [],
      priority: { groups: [], verified: false, verifiedAt: null },
    });
    expect(r.events.map((e) => e.kind)).toEqual(["priority_removed", "pending_check_resolved", "present"]);
    expect(order(d)).toEqual(["joao", "ana"]); // sem a prioridade, vale o número
  });
});

describe("Review Focus 3: sair e voltar repetidas vezes", () => {
  it('RN-PRES-02/C34: 5 ciclos de "Vou sair" e check-in com chamadas no meio nunca travam a fila', () => {
    const ids = ["ana", "joao", "bruno", "dora", "edu", "fabi", "gil", "hugo"];
    let d = dayWith(ids);
    let t = T;
    const step = () => {
      t += MIN;
      return t;
    };
    for (const id of ids.slice(0, 5)) d = enter(d, id, step());
    const present = () => d.items.filter((i) => i.state === "present").map((i) => i.id);
    const matches = () => {
      const e = order(d);
      expect(e.length).toBe(present().length);
      if (present().length > 0) expect(e.length).toBeGreaterThan(0);
      respectsLocks(d);
    };
    const forWhom = ["ana", "joao", "ana", "bruno", "joao"];
    for (const [cycle, x] of forWhom.entries()) {
      if (item(d, x).state === "present") d = leave(d, x, step());
      matches();
      if (cycle % 2 === 0) {
        const first = order(d)[0];
        if (first) d = call(d, first, step());
        matches();
      }
      const others = present().length;
      if (item(d, x).state === "remote") d = enter(d, x, step());
      matches();
      // A janela: quem acabou de ficar elegível não passa à frente dos K primeiros.
      if (others > 0) expect(order(d)[0]).not.toBe(x);
      // Um novo presente a cada ciclo, para ter sempre gente chegando.
      const fresh = ids[5 + (cycle % 3)];
      if (fresh && item(d, fresh).state === "remote") d = enter(d, fresh, step());
      matches();
    }
  });
});

describe("pureza", () => {
  it("ações não alteram o estado recebido (entrada congelada em profundidade)", () => {
    const d = withItem(dayWith(["ana", "joao", "bruno"]), "bruno", { pendingChecks: ["account"] });
    const before = structuredClone(d);
    const p = enter(d, "joao");
    leaving(p, { itemId: "joao" }, T);
    checkIn(d, { itemId: "ana" }, T);
    checkIn(d, { itemId: "bruno" }, T);
    markAttendanceWithoutApp(d, { itemId: "ana" }, T);
    verifyAndMark(d, { itemId: "bruno", result: "matches" }, T);
    verifyAndMark(d, { itemId: "bruno", result: "does_not_match" }, T);
    verifyAndMark(d, { itemId: "bruno", result: "priority_does_not_match" }, T);
    eligible(p, "e1");
    expect(d).toEqual(before);
  });

  it("elegiveis: só presentes da etapa e dos serviços da estação; estação desconhecida → vazio", () => {
    let d = dayWith(["ana", "joao"], {
      stations: [
        { id: "e1", stage: "care", services: ["cli"], open: true, calledItemId: null },
        { id: "t1", stage: "triage", services: ["cli"], open: true, calledItemId: null },
        { id: "o1", stage: "care", services: ["odonto"], open: true, calledItemId: null },
      ],
    });
    d = withItem(d, "joao", { stage: "triage" });
    d = enter(d, "ana");
    d = enter(d, "joao");
    expect(order(d)).toEqual(["ana"]);
    expect(eligible(d, "t1").map((i) => i.id)).toEqual(["joao"]);
    expect(eligible(d, "o1")).toEqual([]);
    expect(eligible(d, "nao_existe")).toEqual([]);
  });
});

describe("RN-RISCO-04: dar prioridade (darPrioridade)", () => {
  const error = (r: Result<SessionDay>) => (r.ok ? "ok" : r.error);
  it("RN-RISCO-04: só na 1ª presença de paciente sem app (ou inclusão no balcão); na fila, recusado", () => {
    const d = dayWith(["joao", "ana"]);
    expect(error(givePriority(d, { itemId: "ana", groups: ["disability"], context: "already_in_queue" }, T))).toBe(
      "no_permission",
    );
    const r = givePriority(
      d,
      { itemId: "ana", groups: ["disability", "elderly"], context: "first_attendance_without_app" },
      T,
    );
    const detail = apply(r);
    // Idoso vem da data de nascimento (AD-027): não se dá.
    expect(item(detail, "ana").priority).toEqual({ groups: ["disability"], verified: true, verifiedAt: T });
    expect(r.ok && r.events).toEqual([
      {
        kind: "priority_given",
        itemId: "ana",
        entryId: "ent-ana",
        data: { groups: ["disability"], context: "first_attendance_without_app" },
      },
    ]);
    // Já conferida pela recepção: a presença entra sem pendência e passa à frente de João.
    const present = apply(markAttendanceWithoutApp(detail, { itemId: "ana" }, T + MIN));
    expect(item(present, "ana").state).toBe("present");
    // Chamado, final ou sessão fechada: recusado.
    expect(
      error(givePriority(call(d, "ana", T), { itemId: "ana", groups: ["disability"], context: "desk_addition" }, T)),
    ).toBe("forbidden_transition");
    expect(
      error(
        givePriority({ ...d, state: "closed" }, { itemId: "ana", groups: ["disability"], context: "desk_addition" }, T),
      ),
    ).toBe("session_closed");
  });
});

describe("minors m1/m5", () => {
  it("m1: ficarElegivel é interno (põe em presente sem contrato); não sai pelo pacote", () => {
    expect("stayEligible" in domain).toBe(false);
  });

  it("m5/RN-PRES-02: Vou sair só com a sessão aberta", () => {
    const d = withItem(dayWith(["ana"]), "ana", { state: "present" });
    for (const state of ["planned", "closed", "cancelled"] as const) {
      expect(leaving({ ...d, state }, { itemId: "ana" }, T)).toEqual({ ok: false, error: "session_closed" });
    }
  });
});

describe("presenteDesde (Fila do dia: há quanto tempo está na unidade)", () => {
  it("marca a hora em que ficou presente e some ao voltar a remoto", () => {
    let d = enter(dayWith(["ana"]), "ana", T);
    expect(item(d, "ana").presentSince).toBe(T);
    d = leave(d, "ana", T + 60_000);
    expect(item(d, "ana").presentSince).toBeNull();
    d = apply(markAttendanceWithoutApp(d, { itemId: "ana" }, T + 120_000));
    expect(item(d, "ana").presentSince).toBe(T + 120_000);
  });
});

describe("RV7: 80+ antes dos demais idosos na fila de verdade (Lei 10.741, art. 3º, § 2º)", () => {
  const groups = (g: QueueItem["priority"]["groups"]) => ({ groups: g, verified: false, verifiedAt: null });
  // Senhas: bia 1 (70 anos), gil 2 (gestante), ana 3 (85 anos), caio 4 (sem prioridade).
  const day = () => {
    let d = dayWith(["bia", "gil", "ana", "caio"]);
    d = withItem(d, "bia", { priority: groups(["elderly"]) });
    d = withItem(d, "gil", { priority: groups(["pregnant"]) });
    d = withItem(d, "ana", { priority: groups(["elderly80"]) });
    // Já presentes, sem as travas da janela protegida (que valem à parte).
    for (const id of ["bia", "gil", "ana", "caio"]) d = withItem(d, id, { state: "present", presentSince: T });
    return d;
  };

  it("a vaga de idoso da senha 1 vai à Ana (85); a Gil fica no lugar dela", () => {
    expect(order(day())).toEqual(["ana", "gil", "bia", "caio"]);
  });

  it("a Ana (85) que chega atrás da Bia (70) pela janela não tira a Bia da frente da Gil", () => {
    let d = dayWith(["bia", "gil", "ana"]);
    d = withItem(d, "bia", { priority: groups(["elderly"]), state: "present", presentSince: T });
    d = withItem(d, "gil", { priority: groups(["pregnant"]), state: "present", presentSince: T });
    d = withItem(d, "ana", { priority: groups(["elderly80"]) });
    expect(order(d)).toEqual(["bia", "gil"]);
    d = enter(d, "ana");
    expect(item(d, "ana").lockedBehind).toEqual(["bia"]);
    expect(order(d)).toEqual(["bia", "gil", "ana"]);
  });

  it("chamada a Ana (85), a Bia (70) fica no lugar que era da Ana: a ordem não muda depois da chamada", () => {
    let d = day();
    d = withItem(d, "ana", { state: "called" });
    d = freeze({ ...d, calls: [{ itemId: "ana", stage: "care", stationId: "e1", at: T + MIN }] });
    expect(order(d)).toEqual(["gil", "bia", "caio"]);
  });

  it("a Ana (85) chamada e depois triada (risco e número novos) continua com a vaga em que foi chamada", () => {
    let d = apply(callNext(day(), { stationId: "e1" }, T + MIN));
    expect(item(d, "ana").state).toBe("called");
    d = withItem(d, "ana", { confirmedUrgency: true, risk: "attention", number: 10 });
    expect(order(d)).toEqual(["gil", "bia", "caio"]);
  });

  it("a Ana (85) chamada que voltou para casa não guarda vaga: ela a ocupa de novo só quando voltar", () => {
    let d = apply(callNext(day(), { stationId: "e1" }, T + MIN));
    d = withItem(d, "ana", { state: "remote", presentSince: null, leftAt: T + 2 * MIN });
    expect(order(d)).toEqual(["bia", "gil", "caio"]);
  });

  it("a Ana (85) chamada que voltou a esperar e depois saiu da fila não volta a guardar a vaga", () => {
    let d = apply(callNext(day(), { stationId: "e1" }, T + MIN));
    d = withItem(d, "ana", { state: "left_queue", presentSince: T + 3 * MIN });
    expect(order(d)).toEqual(["bia", "gil", "caio"]);
  });

  it("no 1º pulo a Ana (85) não guarda vaga enquanto se calcula a trava dela", () => {
    let d = dayWith(["bia", "gil", "ana"]);
    d = withItem(d, "bia", { priority: groups(["elderly"]), state: "present", presentSince: T });
    d = withItem(d, "gil", { priority: groups(["pregnant"]), state: "present", presentSince: T });
    d = withItem(d, "ana", { priority: groups(["elderly80"]), state: "present", presentSince: T });
    d = apply(callNext(d, { stationId: "e1" }, T + MIN));
    d = freeze(stayEligible(d, "ana", T + 2 * MIN, { applyDelay: false }).state);
    expect(item(d, "ana").lockedBehind).toEqual(["bia"]);
  });

  it("travada atrás da Bia (70), a Ana (85) passa à frente do Caio (70) que veio depois", () => {
    let d = dayWith(["bia", "caio", "ana"]);
    d = withItem(d, "bia", { priority: groups(["elderly"]), state: "present", presentSince: T });
    d = withItem(d, "caio", { priority: groups(["elderly"]), state: "present", presentSince: T });
    d = withItem(d, "ana", { priority: groups(["elderly80"]) });
    d = enter(d, "ana");
    expect(order(d)).toEqual(["bia", "ana", "caio"]);
  });
});

describe('AD-076: perde a vez só quem não chega no prazo do "venha agora"', () => {
  it("o prazo padrão é de 30 min", () => {
    expect(DEFAULT_CONFIG.arrivalDeadlineMin).toBe(30);
  });

  it("dentro do prazo mantém o lugar, mesmo com alguém de senha maior já chamado", () => {
    let d = alreadyNotified(dayWith(["ana", "joao"]), "ana", T, 30);
    d = enter(d, "joao");
    d = call(d, "joao", T + MIN);
    d = enter(d, "ana", T + 29 * MIN);
    expect(item(d, "ana").number).toBe(1);
  });

  it("passado o prazo perde a vez, mesmo sem ninguém chamado", () => {
    let d = alreadyNotified(dayWith(["ana", "joao"]), "ana", T, 30);
    d = enter(d, "ana", T + 30 * MIN);
    expect(item(d, "ana").number).toBe(3);
  });

  it("contingência registrada durante o prazo: o relógio do prazo para durante a queda", () => {
    let d = dayWith(["ana", "joao"], { contingencies: [{ start: T + 10 * MIN, end: T + 20 * MIN }] });
    d = alreadyNotified(d, "ana", T, 30);
    expect(item(enter(d, "ana", T + 39 * MIN), "ana").number).toBe(1);
    expect(item(enter(d, "ana", T + 40 * MIN), "ana").number).toBe(3);
  });

  it("urgência confirmada não perde a vez pelo prazo", () => {
    let d = alreadyNotified(dayWith(["ana", "joao"]), "ana", T, 30);
    d = withItem(d, "ana", { confirmedUrgency: true, risk: "urgent" });
    d = enter(d, "ana", T + 60 * MIN);
    expect(item(d, "ana").number).toBe(1);
  });
});
