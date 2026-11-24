import { describe, expect, it } from "vitest";
import { callNext, finish, noShow } from "../src/call.ts";
import {
  cancel,
  cancelEntry,
  chooseDate,
  close,
  entryOutcome,
  giveUp,
  holdsSlot,
  noShowHolder,
  type Origin,
  otherDate,
  registerContingency,
  sessionOrigin,
} from "../src/closing.ts";
import { createEntry, type Entry, refuse, type Service } from "../src/list.ts";
import { checkIn, leaving, type SessionDay, verifyAndMark } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { fillFromReserve, removeRegulatedEntry } from "../src/session.ts";
import { alreadyNotified, answers, call, dayWith, entry, freeze, sessionSlots, withItem } from "./fixtures.ts";

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;
/** 13/11/2026 07:00 em Brasília: início da sessão "s1". */
const T = Date.UTC(2026, 10, 13, 10, 0);

const FREE: Service = freeze({ id: "cli", mode: "direct", requiresTriage: false });
const REFERRAL: Service = freeze({ id: "cli", mode: "referral", requiresTriage: false });
const PRIVATE: Origin = "private";

function apply<E>(r: Result<E>): E {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return freeze(r.state);
}
const events = <E>(r: Result<E>) => {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return r.events;
};
const error = <E>(r: Result<E>) => (r.ok ? "ok" : r.error);

const item = (day: SessionDay, id: string) => {
  const i = day.items.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
};
const ent = (entries: Entry[], id: string) => {
  const e = entries.find((x) => x.id === id);
  if (!e) throw new Error(`entrada ${id} não existe`);
  return e;
};

/** Entradas "na fila" da sessão s1 para os itens de `dayWith` (entradaId = "ent-<id>"). */
const inQueue = (ids: string[]): Entry[] =>
  freeze(ids.map((id) => entry(`ent-${id}`, { state: "in_queue", sessionId: "s1", confirmedRisk: "routine" })));

const step = (r: Result<SessionDay>) => apply(r);
const E1 = { stationId: "e1" };
const WITHOUT_NOTICE = { withoutSignalWithoutContingency: false, origin: PRIVATE };

/**
 * Ana (nº 1, remota) recebe o "venha agora" às 07:00 e não chega no prazo (30 min): perde a vez (AD-076).
 * Bruno faz check-in e é atendido; Caio (nº 3) não recebeu aviso.
 */
function brunoAttended(ids = ["ana", "bruno", "caio"], em = T + 20 * MIN): SessionDay {
  let d = dayWith(ids);
  if (ids.includes("ana")) d = alreadyNotified(d, "ana", T);
  d = step(checkIn(d, { itemId: "bruno" }, em - 10 * MIN));
  d = step(callNext(d, E1, em));
  return step(finish(d, E1, em + 10 * MIN));
}

describe("encerramento (RN-SES-01..04, RN-FALTA-01)", () => {
  it("RN-SES-02: vez não passou → remanejado", () => {
    const day = dayWith(["ana", "bruno"]);
    const r = close(day, inQueue(["ana", "bruno"]), T + 5 * H, WITHOUT_NOTICE);
    const { day: d, entries } = apply(r);
    expect(d.state).toBe("closed");
    expect(d.items.map((i) => i.state)).toEqual(["reassigned", "reassigned"]);
    const ana = ent(entries, "ent-ana");
    expect([ana.state, ana.reassigned, ana.sessionId, ana.refusals]).toEqual(["reassigned", "private", null, 0]);
    // RN-REM-04: mantém risco, prioridade e data original.
    expect(ana.confirmedRisk).toBe("routine");
    expect(ana.originalEntryDate).toBe(entry("x").originalEntryDate);
    expect(events(r).filter((e) => e.kind === "reassigned")).toHaveLength(2);
    expect(events(r).some((e) => e.kind === "no_show")).toBe(false);
    expect(d.closing).toEqual({ at: T + 5 * H, noShows: [], origin: "private" });

    // Novo prejuízo pela unidade: a origem passa a ser a desta sessão e as recusas zeram.
    const already = freeze([
      entry("ent-ana", { state: "in_queue", sessionId: "s1", reassigned: "public", refusals: 1, allocatedAt: T - DAY }),
    ]);
    const de = ent(apply(close(dayWith(["ana"]), already, T + 5 * H, WITHOUT_NOTICE)).entries, "ent-ana");
    expect([de.reassigned, de.refusals, de.allocatedAt]).toEqual(["private", 0, null]);
  });

  it("RN-SES-02: presente nunca leva falta", () => {
    // Ana chega depois que a vez dela passou e está presente no encerramento.
    let day = brunoAttended();
    day = step(checkIn(day, { itemId: "ana" }, T + H));
    const r = close(day, inQueue(["ana", "bruno", "caio"]), T + 5 * H, WITHOUT_NOTICE);
    const { day: d, entries } = apply(r);
    expect(item(d, "ana").state).toBe("reassigned");
    expect(ent(entries, "ent-ana").state).toBe("reassigned");
    expect(events(r).some((e) => e.kind === "no_show")).toBe(false);
    // Bruno já foi atendido: o item não muda e a entrada é concluída (C1).
    expect(item(d, "bruno").state).toBe("done_in_stage");
    expect(ent(entries, "ent-bruno").state).toBe("completed");
  });

  it("RN-SES-02: remoto com a vez passada leva falta", () => {
    const day = brunoAttended();
    const r = close(day, inQueue(["ana", "bruno", "caio"]), T + 5 * H, WITHOUT_NOTICE);
    const { day: d, entries } = apply(r);
    expect(item(d, "ana").state).toBe("left_queue");
    const ana = ent(entries, "ent-ana");
    expect([ana.state, ana.sessionId]).toEqual(["closed_without_care", "s1"]);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "no_show", itemId: "ana", entryId: "ent-ana" }));
    // Caio vem depois de Bruno: a vez dele não passou.
    expect(item(d, "caio").state).toBe("reassigned");
    expect(ent(entries, "ent-caio").state).toBe("reassigned");
    expect(d.closing?.noShows).toEqual(["ana"]);
  });

  it("RN-SES-02/AD-010: chamada feita com a pessoa ainda presente não passa a vez de quem depois saiu", () => {
    // Ana (nº 1) chega e fica travada atrás de Bruno (nº 2, presente antes): Bruno é chamado com ela
    // na unidade; ela toca "Vou sair" e está remota no encerramento.
    let day = dayWith(["ana", "bruno"]);
    day = step(checkIn(day, { itemId: "bruno" }, T));
    day = step(checkIn(day, { itemId: "ana" }, T + MIN));
    expect(item(day, "ana").lockedBehind).toEqual(["bruno"]);
    day = step(callNext(day, E1, T + 2 * MIN));
    expect(item(day, "bruno").state).toBe("called");
    day = step(finish(day, E1, T + 10 * MIN));
    day = step(leaving(day, { itemId: "ana" }, T + 11 * MIN));
    const { day: d } = apply(close(day, inQueue(["ana", "bruno"]), T + H, WITHOUT_NOTICE));
    expect(item(d, "ana").state).toBe("reassigned");
  });

  it("AD-041: triado que saiu é remanejado, não faltoso", () => {
    // Luísa foi atendida na triagem, tocou "Vou sair" e, fora, a vez dela passou no consultório.
    let day = dayWith(["luisa", "bruno"], { requiresTriage: true });
    day = withItem(day, "luisa", { state: "present", attendedInStages: ["triage"] });
    day = step(leaving(day, { itemId: "luisa" }, T));
    day = step(checkIn(day, { itemId: "bruno" }, T + MIN));
    day = step(callNext(day, E1, T + 10 * MIN));
    day = step(finish(day, E1, T + 20 * MIN));
    const r = close(day, inQueue(["luisa", "bruno"]), T + 5 * H, WITHOUT_NOTICE);
    const { day: d, entries } = apply(r);
    expect(item(d, "luisa").state).toBe("reassigned");
    expect(ent(entries, "ent-luisa").state).toBe("reassigned");
    expect(events(r).some((e) => e.kind === "no_show")).toBe(false);
  });

  it("RN-SES-03: não encerra com estação chamando", () => {
    let day = dayWith(["ana"]);
    day = step(checkIn(day, { itemId: "ana" }, T));
    day = step(callNext(day, E1, T + MIN));
    expect(error(close(day, inQueue(["ana"]), T + H, WITHOUT_NOTICE))).toBe("station_has_call");
    // Item chamado sem a estação apontando (estado da fixture) também bloqueia.
    expect(error(close(call(dayWith(["ana"]), "ana", T), inQueue(["ana"]), T + H, WITHOUT_NOTICE))).toBe(
      "station_has_call",
    );
    // Depois de Finalizar, encerra.
    const end = step(finish(day, E1, T + 10 * MIN));
    expect(error(close(end, inQueue(["ana"]), T + H, WITHOUT_NOTICE))).toBe("ok");
    // RN-SES-01: só a partir de aberta.
    expect(error(close(dayWith([], { state: "planned" }), [], T, WITHOUT_NOTICE))).toBe("forbidden_transition");
    expect(error(close(dayWith([], { state: "closed" }), [], T, WITHOUT_NOTICE))).toBe("forbidden_transition");
  });

  it("RN-SES-04: avisa sinal perdido sem bloquear", () => {
    const day = dayWith(["ana"]);
    const withValue = close(day, inQueue(["ana"]), T + H, { withoutSignalWithoutContingency: true, origin: PRIVATE });
    expect(withValue.ok).toBe(true);
    expect(withValue.notice).toBe("signal_lost");
    const without = close(day, inQueue(["ana"]), T + H, WITHOUT_NOTICE);
    expect(without.ok).toBe(true);
    expect("notice" in without).toBe(false);
  });

  it("RN-SES-02: reserva da sessão é cancelada no encerramento", () => {
    const reserve = entry("r1", { state: "in_reserve", sessionId: "s1" });
    const other = entry("r2", { state: "in_reserve", sessionId: "s2" });
    const r = close(dayWith([]), freeze([reserve, other]), T + H, {
      withoutSignalWithoutContingency: false,
      origin: "public",
    });
    const { entries } = apply(r);
    expect(ent(entries, "r1").state).toBe("cancelled");
    expect(ent(entries, "r2")).toBe(other);
  });

  it("RN-CONT-03: prazo de chegada perdido durante contingência registrada → remanejado no encerramento", () => {
    const day = freeze({ ...brunoAttended(), contingencies: [{ start: T, end: T + 5 * H, reason: "queda" }] });
    const r = close(day, inQueue(["ana", "bruno", "caio"]), T + 5 * H, WITHOUT_NOTICE);
    const { day: d } = apply(r);
    expect(item(d, "ana").state).toBe("reassigned");
    expect(events(r).some((e) => e.kind === "no_show")).toBe(false);
  });

  it("RN-CONT-03: contingência registrada depois do encerramento apaga a falta e remaneja", () => {
    // Prazo de Ana das 07:00 às 07:30 (Brasília); sessão encerrada às 12:00 com falta dela.
    const closed = apply(close(brunoAttended(), inQueue(["ana", "bruno", "caio"]), T + 5 * H, WITHOUT_NOTICE));
    expect(ent(closed.entries, "ent-ana").state).toBe("closed_without_care");

    // Às 13:00 do mesmo dia, a recepção registra a queda das 07:00 às 12:00: o prazo dela não acabou.
    const period = { start: T, end: T + 5 * H, reason: "internet caiu" };
    const r = registerContingency(closed.day, closed.entries, period, T + 6 * H);
    const { day, entries } = apply(r);
    expect(day.contingencies).toEqual([period]);
    expect(item(closed.day, "ana").exitReason).toBe("no_show");
    expect(item(day, "ana")).toMatchObject({ state: "reassigned", exitReason: null });
    const ana = ent(entries, "ent-ana");
    expect([ana.state, ana.reassigned, ana.sessionId]).toEqual(["reassigned", "private", null]);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "no_show_voided", entryId: "ent-ana" }));
    expect(day.closing?.noShows).toEqual([]);

    // Período que não cruza o prazo dela: a falta fica.
    const outside = apply(
      registerContingency(closed.day, closed.entries, { start: T + 2 * H, end: T + 3 * H, reason: "x" }, T + 6 * H),
    );
    expect(ent(outside.entries, "ent-ana").state).toBe("closed_without_care");

    // Período que ainda não terminou: recusado (registra-se na volta).
    expect(error(registerContingency(closed.day, closed.entries, { ...period, end: T + 7 * H }, T + 6 * H))).toBe(
      "forbidden_transition",
    );
    // Com a sessão aberta: só grava o período (a regra de atraso e o encerramento o usam).
    const open = apply(registerContingency(brunoAttended(), [], period, T + 6 * H));
    expect([open.day.state, open.day.contingencies]).toEqual(["open", [period]]);

    // Entrada que não veio (ou não está encerrada por falta): o item e a falta ficam como estão.
    for (const entries of [
      [],
      closed.entries.map((e) => (e.id === "ent-ana" ? { ...e, state: "cancelled" as const } : e)),
    ]) {
      const without = apply(registerContingency(closed.day, entries, period, T + 6 * H));
      expect(item(without.day, "ana").state).toBe("left_queue");
      expect(without.day.closing?.noShows).toEqual(["ana"]);
    }

    // Registrado no dia seguinte: grava o período, mas não recalcula.
    const after = apply(registerContingency(closed.day, closed.entries, period, T + DAY));
    expect(after.day.contingencies).toEqual([period]);
    expect(ent(after.entries, "ent-ana").state).toBe("closed_without_care");

    // Período inválido e sessão que não abriu: recusados.
    expect(error(registerContingency(closed.day, closed.entries, { ...period, end: T }, T + 6 * H))).toBe(
      "forbidden_transition",
    );
    expect(error(registerContingency(dayWith([], { state: "planned" }), [], period, T + 6 * H))).toBe(
      "forbidden_transition",
    );
  });

  it('RN-CONT-03: "no mesmo dia" é o dia do encerramento no fuso da unidade (limite da meia-noite)', () => {
    // Encerrada às 23:30 de 13/11 em Brasília (02:30 UTC de 14/11), com falta de Ana.
    const closed = apply(
      close(brunoAttended(), inQueue(["ana", "bruno", "caio"]), Date.UTC(2026, 10, 14, 2, 30), WITHOUT_NOTICE),
    );
    const period = { start: T, end: Date.UTC(2026, 10, 14, 2, 30), reason: "queda" };
    const register = (at: number) =>
      ent(apply(registerContingency(closed.day, closed.entries, period, at)).entries, "ent-ana").state;
    expect(register(Date.UTC(2026, 10, 14, 2, 59, 59))).toBe("reassigned"); // 23:59:59, mesmo dia
    expect(register(Date.UTC(2026, 10, 14, 3, 0))).toBe("closed_without_care"); // 00:00 do dia seguinte
  });

  it("RN-ID-06/AD-040: titular da falta", () => {
    const e = entry("x");
    const cases: [verified: boolean, verified: boolean, registered: boolean, holder: string][] = [
      [true, false, false, "person"], // pessoa atendida conferida na unidade
      [false, true, false, "guardian"], // não conferida: vai ao responsável verificado
      [false, false, false, "nobody"], // conta não verificada: não vai ao CPF de ninguém
      [false, false, true, "person"], // lançado pela regulação: CPF veio da regulação
    ];
    for (const [documentVerified, accountVerified, registered, holder] of cases) {
      expect(noShowHolder(e, documentVerified, accountVerified, registered)).toBe(holder);
    }
    // Pessoa local sem conta e não conferida: ninguém.
    expect(noShowHolder(entry("y", { guardianId: null }), false, true, false)).toBe("nobody");
  });
});

describe("AD-076: faltas no encerramento", () => {
  it("remoto que perdeu o prazo: falta, mesmo sem ninguém chamado", () => {
    const day = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30);
    const r = close(day, inQueue(["ana", "bruno"]), T + H, WITHOUT_NOTICE);
    const { day: d } = apply(r);
    expect(item(d, "ana").state).toBe("left_queue");
    expect(item(d, "bruno").state).toBe("reassigned");
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "no_show", itemId: "ana", reason: "perdeu o prazo de chegada" }),
    );
  });

  it("remoto ainda dentro do prazo: remanejado", () => {
    const day = alreadyNotified(dayWith(["ana", "bruno"]), "ana", T, 30);
    const { day: d } = apply(close(day, inQueue(["ana", "bruno"]), T + 20 * MIN, WITHOUT_NOTICE));
    expect(item(d, "ana").state).toBe("reassigned");
  });

  it("remoto que perdeu o prazo durante uma contingência registrada: remanejado", () => {
    let day = dayWith(["ana", "bruno"], { contingencies: [{ start: T + 10 * MIN, end: T + 20 * MIN }] });
    day = alreadyNotified(day, "ana", T, 30);
    // O prazo para durante os 10 min da queda: vai até 07:40.
    const at = (now: number) => item(apply(close(day, inQueue(["ana", "bruno"]), now, WITHOUT_NOTICE)).day, "ana");
    expect(at(T + 35 * MIN).state).toBe("reassigned");
    expect(at(T + 40 * MIN).state).toBe("left_queue");
  });
});

describe("cancelamento da sessão (RN-REM)", () => {
  it("cancelar: reserva é cancelada, não remanejada", () => {
    const entries = freeze([
      entry("conf", { state: "confirmed", sessionId: "s1" }),
      entry("segura", { state: "awaiting_referral", sessionId: "s1" }),
      entry("res", { state: "in_reserve", sessionId: "s1" }),
      entry("list", { state: "waiting" }),
    ]);
    const day = dayWith([], { state: "planned" });
    const r = cancel(day, entries, T - H, { origin: "public" });
    const { day: d, entries: fresh } = apply(r);
    expect(d.state).toBe("cancelled");
    expect(ent(fresh, "conf").state).toBe("reassigned");
    expect(ent(fresh, "conf").reassigned).toBe("public");
    expect(ent(fresh, "segura").state).toBe("reassigned");
    expect(ent(fresh, "res").state).toBe("cancelled");
    expect(ent(fresh, "list")).toBe(entries[3]);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "cancelled", entryId: "res" }));
  });

  it("cancelar: com a sessão aberta, inclusive o chamado vira remanejado", () => {
    let day = brunoAttended(["ana", "bruno", "caio"]);
    day = step(checkIn(day, { itemId: "caio" }, T + H));
    day = step(callNext(day, E1, T + H + MIN));
    expect(item(day, "caio").state).toBe("called");
    const r = cancel(day, inQueue(["ana", "bruno", "caio"]), T + 2 * H, { origin: PRIVATE });
    const { day: d, entries } = apply(r);
    expect(d.state).toBe("cancelled");
    expect(item(d, "caio").state).toBe("reassigned");
    expect(item(d, "ana").state).toBe("reassigned"); // cancelamento nunca gera falta
    expect(item(d, "bruno").state).toBe("done_in_stage"); // já atendido não é afetado
    expect(d.stations[0]?.calledItemId).toBeNull();
    expect(ent(entries, "ent-caio").state).toBe("reassigned");
    expect(ent(entries, "ent-bruno").state).toBe("completed"); // atendido: concluída, não remanejada (C1)
    expect(events(r).some((e) => e.kind === "no_show")).toBe(false);
    // Já encerrada ou cancelada: não cancela de novo.
    expect(error(cancel(d, entries, T + 3 * H, { origin: PRIVATE }))).toBe("forbidden_transition");
  });

  it("RN-REM-03: origem do remanejado vem da sessão e do serviço", () => {
    const service = (mode: Service["mode"]): Service => ({ id: "cli", mode, requiresTriage: false });
    expect(sessionOrigin(sessionSlots(), service("direct"))).toBe("private");
    expect(sessionOrigin(sessionSlots({ visibility: "public" }), service("direct"))).toBe("public");
    expect(sessionOrigin(sessionSlots(), service("regulated"))).toBe("regulated");
  });
});

describe("remanejado (RN-REM-03..05)", () => {
  it("RN-REM-03: outra data 1ª mantém, 2ª perde a preferência por origem", () => {
    // 1ª vez: continua remanejado, com a preferência, e libera a vaga.
    const conf = entry("ana", { state: "confirmed", sessionId: "s2", reassigned: "private" });
    const s2 = sessionSlots({ id: "s2", taken: 1 });
    const r1 = otherDate(conf, s2, T);
    const { entry: a1, session: s2depois } = apply(r1);
    expect([a1.state, a1.reassigned, a1.refusals, a1.sessionId]).toEqual(["reassigned", "private", 1, null]);
    expect(s2depois.taken).toBe(0);
    expect(events(r1)).toContainEqual(expect.objectContaining({ kind: "slot_released", sessionId: "s2" }));

    // 2ª vez, por origem.
    const s3 = sessionSlots({ id: "s3", taken: 1 });
    const second = (reassigned: Entry["reassigned"]) =>
      otherDate(entry("ana", { state: "allocated", sessionId: "s3", reassigned, refusals: 1, allocatedAt: T }), s3, T);
    const priv = apply(second("private")).entry;
    expect([priv.state, priv.reassigned, priv.originalEntryDate]).toEqual([
      "waiting",
      null,
      entry("x").originalEntryDate,
    ]);
    const pub = second("public");
    expect(apply(pub).entry.state).toBe("cancelled");
    expect(events(pub)).toContainEqual(expect.objectContaining({ kind: "cancelled", reason: "inscreva-se de novo" }));
    const reg = second("regulated");
    expect(apply(reg).entry.state).toBe("cancelled");
    expect(events(reg)).toContainEqual(expect.objectContaining({ kind: "cancelled", reason: "comunicar a regulação" }));

    // Na fila, ainda remoto: sai da fila do dia; presente não pode.
    const day = dayWith(["ana"]);
    const inQueueAna = entry("ent-ana", { state: "in_queue", sessionId: "s1", reassigned: "private" });
    const s1 = sessionSlots({ taken: 1 });
    const nf = apply(otherDate(inQueueAna, s1, T, day));
    expect(nf.entry.state).toBe("reassigned");
    expect(nf.day && item(nf.day, "ana").state).toBe("left_queue");
    const present = withItem(day, "ana", { state: "present" });
    expect(error(otherDate(inQueueAna, s1, T, present))).toBe("forbidden_transition");
    expect(error(otherDate(inQueueAna, s1, T))).toBe("forbidden_transition");

    // Não remanejado, ou 2ª vez sem linha no contrato: recusado.
    expect(error(otherDate(entry("b", { state: "confirmed", sessionId: "s2" }), s2, T))).toBe("forbidden_transition");
    expect(error(otherDate({ ...inQueueAna, refusals: 1 }, s1, T, day))).toBe("forbidden_transition");
    // Sessão que não é a da entrada: recusado.
    expect(error(otherDate(conf, s3, T))).toBe("forbidden_transition");
  });

  it('RN-REM-03: "Outra data" só na sessão privada ou regulada; remanejado em sessão pública não tem', () => {
    // Ana, remanejada de pública, escolheu outra sessão pública (RN-REM-05): ali não há "Outra data".
    const pub = sessionSlots({ id: "s2", visibility: "public", taken: 1 });
    const ana = entry("ana", { state: "confirmed", sessionId: "s2", reassigned: "public" });
    expect(error(otherDate(ana, pub, T))).toBe("forbidden_transition");
    expect(error(otherDate({ ...ana, refusals: 1 }, pub, T))).toBe("forbidden_transition");
    // Alocada numa privada, tem.
    const priv = sessionSlots({ id: "s2", taken: 1 });
    expect(apply(otherDate(ana, priv, T)).entry.state).toBe("reassigned");
  });

  it('RN-REM-03: recusar e "Outra data" de remanejada alocada dão o mesmo resultado (uma regra só)', () => {
    const s = sessionSlots({ id: "s2", taken: 1 });
    for (const reassigned of ["private", "public", "regulated"] as const) {
      for (const refusals of [0, 1]) {
        const e = entry("ana", { state: "allocated", sessionId: "s2", reassigned, refusals, allocatedAt: T });
        const a = refuse(e, s, T);
        const b = otherDate(e, s, T);
        if (!a.ok || !b.ok) throw new Error("recusado");
        expect(b.state).toEqual(a.state);
        expect(b.events).toEqual(a.events);
      }
    }
  });

  it("RN-REM-03: Desistir cancela de vez", () => {
    const conf = entry("ana", { state: "confirmed", sessionId: "s2", reassigned: "regulated" });
    const r = giveUp(conf, sessionSlots({ id: "s2", taken: 1 }), T);
    expect([apply(r).entry.state, apply(r).entry.reassigned]).toEqual(["cancelled", null]);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "slot_released", sessionId: "s2" }));
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "cancelled", reason: "comunicar a regulação" }));
    // Aguardando remarcação também desiste.
    expect(apply(giveUp(entry("b", { state: "reassigned", reassigned: "public" }), null, T)).entry.state).toBe(
      "cancelled",
    );
    expect(error(giveUp(entry("c", { state: "confirmed", sessionId: "s2" }), sessionSlots({ id: "s2" }), T))).toBe(
      "forbidden_transition",
    );

    // Na fila (remoto ou presente): sai da fila do dia; chamado, não.
    const day = dayWith(["ana"]);
    const inQueueAna = entry("ent-ana", { state: "in_queue", sessionId: "s1", reassigned: "private" });
    const s1Taken = sessionSlots({ taken: 1 });
    for (const state of ["remote", "present"] as const) {
      const d = apply(giveUp(inQueueAna, s1Taken, T, withItem(day, "ana", { state })));
      expect([d.entry.state, d.day && item(d.day, "ana").state]).toEqual(["cancelled", "left_queue"]);
    }
    expect(error(giveUp(inQueueAna, s1Taken, T, call(day, "ana", T)))).toBe("forbidden_transition");
    expect(error(giveUp(inQueueAna, s1Taken, T))).toBe("forbidden_transition");
  });

  it("RN-REM-05: remanejado de pública escolhe; lotada → topo da reserva", () => {
    const ana = entry("ana", { state: "reassigned", reassigned: "public", sessionId: null });
    const session = sessionSlots({ id: "s2", visibility: "public", slots: 2, taken: 1 });

    // Com vaga: confirmado, ocupando a vaga.
    const r = chooseDate(ana, session, null, { service: FREE, acceptedPhoto: false }, T);
    const ok = apply(r);
    expect([ok.entry.state, ok.entry.sessionId, ok.entry.reassigned]).toEqual(["confirmed", "s2", "public"]);
    expect(ok.session.taken).toBe(2);

    // Sessão já aberta: direto na fila remota com o próximo número.
    const day = dayWith(["x"], { sessionId: "s2" });
    const open = apply(chooseDate(ana, session, day, { service: FREE, acceptedPhoto: false }, T));
    expect(open.entry.state).toBe("in_queue");
    const it2 = open.day?.items.find((i) => i.entryId === "ana");
    expect([it2?.state, it2?.number]).toEqual(["remote", 2]);

    // Requisição sem foto: vaga segura antes da abertura; com a sessão aberta, recusado.
    const sec = apply(chooseDate(ana, session, null, { service: REFERRAL, acceptedPhoto: false }, T));
    expect(sec.entry.state).toBe("awaiting_referral");
    expect(error(chooseDate(ana, session, day, { service: REFERRAL, acceptedPhoto: false }, T))).toBe(
      "referral_pending",
    );

    // Lotada: topo da reserva, sem ocupar vaga; a vaga liberada vai a ela antes de quem já esperava.
    const full = sessionSlots({ id: "s2", visibility: "public", slots: 1, taken: 1 });
    const res = apply(chooseDate(ana, full, null, { service: FREE, acceptedPhoto: false }, T));
    expect([res.entry.state, res.entry.sessionId]).toEqual(["in_reserve", "s2"]);
    expect(res.session.taken).toBe(1);
    const old = entry("antiga", {
      state: "in_reserve",
      sessionId: "s2",
      originalEntryDate: res.entry.originalEntryDate - 30 * DAY,
    });
    const released = { ...res.session, taken: res.session.taken - 1 }; // alguém saiu
    const lib = apply(
      fillFromReserve(released, null, freeze([old, res.entry]), { service: FREE, acceptedPhotos: [] }, T + H),
    );
    expect(ent(lib.entries, "ana").state).toBe("confirmed");
    expect(ent(lib.entries, "antiga").state).toBe("in_reserve");

    // Só remanejado de pública, em sessão pública do serviço.
    const priv = entry("b", { state: "reassigned", reassigned: "private" });
    expect(error(chooseDate(priv, session, null, { service: FREE, acceptedPhoto: false }, T))).toBe(
      "forbidden_transition",
    );
    expect(error(chooseDate(ana, sessionSlots({ id: "s2" }), null, { service: FREE, acceptedPhoto: false }, T))).toBe(
      "forbidden_transition",
    );
    // Já tem item no dia (INV-05): duplicada.
    const withAna = dayWith(["ana"], { sessionId: "s2" });
    const anaWithId = { ...ana, id: "ent-ana" };
    expect(error(chooseDate(anaWithId, session, withAna, { service: FREE, acceptedPhoto: false }, T))).toBe(
      "duplicate",
    );
  });

  it("INV-10: remanejado nunca tira a vaga de quem já está confirmado", () => {
    const full = sessionSlots({ id: "s2", visibility: "public", slots: 2, taken: 2 });
    const confirmed = freeze([
      entry("a", { state: "confirmed", sessionId: "s2" }),
      entry("b", { state: "confirmed", sessionId: "s2" }),
    ]);
    const ana = entry("ana", { state: "reassigned", reassigned: "public" });
    const r = apply(chooseDate(ana, full, null, { service: FREE, acceptedPhoto: false }, T));
    expect(r.entry.state).toBe("in_reserve");
    expect(r.session.taken).toBe(2);
    // Mesmo com a sessão aberta e cheia, ninguém sai da fila por causa dela.
    const day = dayWith(["a", "b"], { sessionId: "s2" });
    const r2 = apply(chooseDate(ana, full, day, { service: FREE, acceptedPhoto: false }, T));
    expect(r2.entry.state).toBe("in_reserve");
    expect(r2.day).toBe(day);
    // A reserva só recebe vaga livre: sem liberação, os confirmados ficam.
    const withoutSlot = apply(
      fillFromReserve(
        full,
        null,
        freeze([...confirmed, r.entry]),
        {
          service: FREE,
          acceptedPhotos: [],
        },
        T,
      ),
    );
    expect(withoutSlot.entries.filter((e) => e.state === "confirmed").map((e) => e.id)).toEqual(["a", "b"]);
    expect(ent(withoutSlot.entries, "ana").state).toBe("in_reserve");
  });

  it("INV-02: desistir, outra data, recusa, cancelamento e remoção liberam exatamente uma vaga, no mesmo formato", () => {
    // Toda saída que libera vaga devolve { entrada, sessao, dia } com a sessão já liberada;
    // quem chama depois só chama preencherDaReserva (RN-PUB-02, RN-CANC-02).
    const s = sessionSlots({ id: "s2", taken: 2 });
    const REGULATED: Service = freeze({ id: "cli", mode: "regulated", requiresTriage: false });
    const reassigned = entry("ana", { state: "confirmed", sessionId: "s2", reassigned: "private" });
    const allocated = entry("bia", { state: "allocated", sessionId: "s2", allocatedAt: T });
    const registered = entry("caio", { state: "confirmed", sessionId: "s2", confirmedRisk: "routine" });
    const exits = [
      giveUp(reassigned, s, T),
      otherDate(reassigned, s, T),
      refuse(allocated, s, T),
      removeRegulatedEntry(registered, s, null, { service: REGULATED, reason: "x" }, T),
      cancelEntry(entry("eva", { state: "confirmed", sessionId: "s2" }), s, null, { service: FREE }, T),
    ];
    for (const r of exits) {
      const st = apply(r);
      expect(Object.keys(st).sort()).toEqual(["day", "entry", "session"]);
      expect(st.session?.taken).toBe(1);
      expect(events(r).filter((e) => e.kind === "slot_released")).toHaveLength(1);
    }
    // Desistir de quem não tem data não mexe em sessão nenhuma.
    const withoutDate = apply(giveUp(entry("d", { state: "reassigned", reassigned: "public" }), null, T));
    expect(withoutDate.session).toBeNull();
    // Com data, a sessão tem de ser a da entrada.
    expect(error(giveUp(reassigned, null, T))).toBe("forbidden_transition");
    expect(error(giveUp(reassigned, sessionSlots({ id: "s9", taken: 1 }), T))).toBe("forbidden_transition");
  });

  it("ações de encerramento não alteram o que recebem", () => {
    // Tudo acima usa estado congelado em profundidade; aqui, a cadeia completa.
    const day = freeze(brunoAttended());
    const entries = inQueue(["ana", "bruno", "caio"]);
    expect(() => {
      const f = apply(close(day, entries, T + 5 * H, WITHOUT_NOTICE));
      registerContingency(f.day, f.entries, { start: T, end: T + H, reason: "x" }, T + 6 * H);
      cancel(day, entries, T + 5 * H, { origin: PRIVATE });
    }).not.toThrow();
  });
});

describe("desfecho da fila do dia na entrada (C1)", () => {
  /** Ana chamada e não compareceu 2 vezes (volta atrás do próximo, depois sai da fila com falta). */
  function twoSkips(): SessionDay {
    let d = dayWith(["ana"]);
    d = step(checkIn(d, { itemId: "ana" }, T));
    d = step(callNext(d, E1, T + MIN));
    d = step(noShow(d, E1, T + 6 * MIN)); // 1º: a vez fica guardada
    d = step(callNext(d, E1, T + 7 * MIN));
    return step(noShow(d, E1, T + 12 * MIN)); // 2º: sai da fila
  }

  const first = (ids: string[]): Entry => {
    const [e] = inQueue(ids);
    if (!e) throw new Error("sem entrada");
    return e;
  };

  it("RN-CHAM-03: 2º pulo encerra a entrada e a pessoa pode criar entrada nova", () => {
    const d = twoSkips();
    expect(item(d, "ana")).toMatchObject({ state: "left_queue", exitReason: "skips" });
    const end = apply(entryOutcome(first(["ana"]), item(d, "ana")));
    expect(end.state).toBe("closed_without_care");
    // RN-CHAM-03: "Ele pode entrar de novo na lista como entrada nova".
    const fresh = createEntry(
      [end],
      { service: FREE, person: end.person, guardianId: "resp-1", answers: answers(), id: "ana-2" },
      T + DAY,
    );
    expect(error(fresh)).toBe("ok");
  });

  it("RN-CHAM-02: atendido na última etapa → Concluída", () => {
    const day = brunoAttended();
    const bruno = first(["bruno"]);
    expect(apply(entryOutcome(bruno, item(day, "bruno"))).state).toBe("completed");
    // Item de outra entrada, ou ainda na fila: não há desfecho.
    expect(error(entryOutcome(bruno, item(day, "ana")))).toBe("forbidden_transition");
    expect(error(entryOutcome(first(["ana"]), item(day, "ana")))).toBe("forbidden_transition");
    // Entrada que já saiu de "Na fila": nada a fazer.
    expect(error(entryOutcome({ ...bruno, state: "completed" }, item(day, "bruno")))).toBe("forbidden_transition");
  });

  it("H2: encaminhado à emergência na triagem (atendido na triagem, sem atendimento) → Concluída", () => {
    const inTriage = withItem(dayWith(["bruno"]), "bruno", { stage: "triage", state: "done_in_stage" });
    expect(apply(entryOutcome(first(["bruno"]), item(inTriage, "bruno"))).state).toBe("completed");
  });

  it("RN-FILA-05: não conferiu → entrada Cancelada, sem falta", () => {
    const d = step(verifyAndMark(dayWith(["ana"]), { itemId: "ana", result: "does_not_match", reason: "doc" }, T));
    expect(item(d, "ana")).toMatchObject({ state: "left_queue", exitReason: "not_verified" });
    const r = entryOutcome(first(["ana"]), item(d, "ana"));
    expect(apply(r).state).toBe("cancelled");
    expect(events(r).some((e) => e.kind === "no_show")).toBe(false);
  });

  it("C1: o encerramento e o cancelamento da sessão fecham a entrada de quem já teve desfecho no dia", () => {
    const r = apply(close(brunoAttended(), inQueue(["ana", "bruno", "caio"]), T + 5 * H, WITHOUT_NOTICE));
    expect(ent(r.entries, "ent-bruno").state).toBe("completed");
    // Sessão cancelada também fecha quem já teve desfecho, sem remanejar.
    const c = apply(cancel(brunoAttended(), inQueue(["ana", "bruno", "caio"]), T + 5 * H, { origin: PRIVATE }));
    expect(ent(c.entries, "ent-bruno").state).toBe("completed");
    expect(ent(c.entries, "ent-ana").state).toBe("reassigned");
  });

  it("C1: o encerramento fecha a entrada do 2º pulo e a do não conferiu", () => {
    const r1 = apply(close(twoSkips(), inQueue(["ana"]), T + 5 * H, WITHOUT_NOTICE));
    expect(ent(r1.entries, "ent-ana").state).toBe("closed_without_care");
    expect(r1.day.closing?.noShows).toEqual([]); // a falta foi do 2º pulo, não do encerramento
    const conf = step(verifyAndMark(dayWith(["bia"]), { itemId: "bia", result: "does_not_match" }, T));
    const r2 = apply(close(conf, inQueue(["bia"]), T + 5 * H, WITHOUT_NOTICE));
    expect(ent(r2.entries, "ent-bia").state).toBe("cancelled");
  });

  it("RN-CANC-02: paciente cancela confirmada/na fila e a vaga vai para a reserva", () => {
    const pub = sessionSlots({ visibility: "public", slots: 1, taken: 1 });
    const ana = entry("ana", { state: "confirmed", sessionId: "s1" });
    const bia = entry("bia", { state: "in_reserve", sessionId: "s1", originalEntryDate: T - DAY });
    const r = cancelEntry(ana, pub, null, { service: FREE }, T);
    const exit = apply(r);
    expect([exit.entry.state, exit.session?.taken, exit.day]).toEqual(["cancelled", 0, null]);
    expect(events(r).map((e) => e.kind)).toEqual(["slot_released", "cancelled"]);
    if (!exit.session) throw new Error("sem sessão");
    const res = apply(
      fillFromReserve(exit.session, null, freeze([exit.entry, bia]), { service: FREE, acceptedPhotos: [] }, T),
    );
    expect(ent(res.entries, "bia").state).toBe("confirmed");
    expect(res.session.taken).toBe(1);

    // Na fila (remota ou presente): o item sai da fila do dia; chamado, não.
    const day = dayWith(["ana"]);
    const inQueueAna = entry("ent-ana", { state: "in_queue", sessionId: "s1" });
    for (const state of ["remote", "present"] as const) {
      const c = apply(cancelEntry(inQueueAna, pub, withItem(day, "ana", { state }), { service: FREE }, T));
      expect(c.entry.state).toBe("cancelled");
      expect(c.day && item(c.day, "ana")).toMatchObject({ state: "left_queue", exitReason: "cancelled" });
    }
    expect(error(cancelEntry(inQueueAna, pub, call(day, "ana", T), { service: FREE }, T))).toBe("forbidden_transition");
    // RN-CANC-03: quem cancela pode fazer entrada nova (sem a posição antiga).
    const fresh = createEntry(
      [exit.entry],
      { service: FREE, person: ana.person, guardianId: "resp-1", answers: answers(), id: "ana-2" },
      T,
    );
    expect(error(fresh)).toBe("ok");
  });

  it("RN-CANC-02: lista, reserva, regulado e remanejado", () => {
    // Sem vaga (aguardando, na reserva): cancela sem sessão.
    expect(apply(cancelEntry(entry("a"), null, null, { service: FREE }, T)).entry.state).toBe("cancelled");
    const reserve = entry("b", { state: "in_reserve", sessionId: "s1" });
    const rr = cancelEntry(reserve, null, null, { service: FREE }, T);
    expect([apply(rr).entry.state, apply(rr).session]).toEqual(["cancelled", null]);
    expect(events(rr).some((e) => e.kind === "slot_released")).toBe(false);
    // Com vaga, a sessão tem de ser a da entrada.
    const conf = entry("c", { state: "confirmed", sessionId: "s1" });
    expect(error(cancelEntry(conf, null, null, { service: FREE }, T))).toBe("forbidden_transition");
    expect(error(cancelEntry(conf, sessionSlots({ id: "s9" }), null, { service: FREE }, T))).toBe(
      "forbidden_transition",
    );
    // Regulado: "Paciente desmarca ou desiste"; vaga liberada sem sugestão, agendador avisado.
    const REGULATED: Service = freeze({ id: "cli", mode: "regulated", requiresTriage: false });
    const reg = cancelEntry(conf, sessionSlots({ taken: 1 }), null, { service: REGULATED }, T);
    expect(apply(reg).entry.state).toBe("cancelled");
    expect(events(reg)).toContainEqual(expect.objectContaining({ kind: "cancelled", reason: "comunicar a regulação" }));
    // Remanejada usa "Desistir" (RN-REM-03).
    const rem = entry("d", { state: "confirmed", sessionId: "s1", reassigned: "private" });
    expect(error(cancelEntry(rem, sessionSlots({ taken: 1 }), null, { service: FREE }, T))).toBe(
      "forbidden_transition",
    );
  });

  it("desfecho e cancelamento não alteram o que recebem", () => {
    const d = freeze(twoSkips());
    const inQueueAna = entry("ent-ana", { state: "in_queue", sessionId: "s1" });
    expect(() => {
      entryOutcome(first(["ana"]), item(d, "ana"));
      cancelEntry(inQueueAna, sessionSlots({ taken: 1 }), dayWith(["ana"]), { service: FREE }, T);
    }).not.toThrow();
  });
});

describe("holdsSlot", () => {
  it("RN-CANC-01: alocada, confirmada, na fila e a vaga segura (aguardando requisição com sessão) ocupam vaga", () => {
    const e = (state: Entry["state"], sessionId: string | null = "s1") => ({ state, sessionId });
    expect(holdsSlot(e("allocated"))).toBe(true);
    expect(holdsSlot(e("in_queue"))).toBe(true);
    expect(holdsSlot(e("awaiting_referral"))).toBe(true);
    expect(holdsSlot(e("awaiting_referral", null))).toBe(false);
    expect(holdsSlot(e("waiting", null))).toBe(false);
    expect(holdsSlot(e("in_reserve"))).toBe(false);
  });
});
