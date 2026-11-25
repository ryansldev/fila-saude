import { describe, expect, it } from "vitest";
import { callNext, finish } from "../src/call.ts";
import { close } from "../src/closing.ts";
import { ENTRY_TRANSITIONS } from "../src/contracts.ts";
import {
  allocate,
  callList,
  confirm,
  destinationByCondition,
  type Entry,
  pendingAtOpening,
  type Service,
  type SessionSlots,
  suggest,
  verificationInEntry,
} from "../src/list.ts";
import { checkIn, DEFAULT_CONFIG, eligible, type SessionDay, verifyAndMark } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import {
  acceptReferral,
  fillFromReserve,
  includeAtDesk,
  itemIdFor,
  open,
  openSession,
  redoQuestionnaire,
  registerRegulated,
  removeRegulatedEntry,
  signUpPublic,
  switchReserve,
} from "../src/session.ts";
import { answers, entry, freeze, newProblem, sessionSlots } from "./fixtures.ts";

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;
/** 12/11/2026 07:00 em Brasília; a sessão "s1" começa em 13/11 07:00. */
const T = Date.UTC(2026, 10, 12, 10, 0);
const START = Date.UTC(2026, 10, 13, 10, 0);

const FREE: Service = freeze({ id: "cli", mode: "direct", requiresTriage: false });
const REFERRAL: Service = freeze({ id: "car", mode: "referral", requiresTriage: false });
const REGULATED: Service = freeze({ id: "reg", mode: "regulated", requiresTriage: false });

function apply<E>(r: Result<E>): E {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return freeze(r.state);
}

function events<E>(r: Result<E>) {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return r.events;
}

const error = <E>(r: Result<E>) => (r.ok ? "ok" : r.error);

/** Dia da sessão ainda planejado, sem itens. */
function plannedDay(partial: Partial<SessionDay> = {}): SessionDay {
  return freeze({
    sessionId: "s1",
    serviceId: "cli",
    state: "planned",
    items: [],
    calls: [],
    leaveHomeNotices: [],
    stations: [{ id: "e1", stage: "care", services: ["cli"], open: true, calledItemId: null }],
    config: DEFAULT_CONFIG,
    contingencies: [],
    nextNumber: 1,
    ticketPrefix: "C",
    requiresTriage: false,
    ...partial,
  });
}

/** A sessão com uma vaga a menos ocupada: quem saiu já a liberou (a saída do teste é feita à mão). */
const free = (s: SessionSlots): SessionSlots => ({ ...s, taken: s.taken - 1 });

const publicOne = (partial: Partial<SessionSlots> = {}) => sessionSlots({ visibility: "public", ...partial });

type State = { session: SessionSlots; day: SessionDay | null; entries: Entry[] };

/** Inscreve `nome` na sessão pública (adulto sem prioridade, sem CPF) e acumula o estado. */
function signUp(
  st: State,
  name: string,
  now = T,
  extra: { service?: Service; acceptedPhoto?: boolean; birthDate?: string } = {},
): State {
  const r = signUpPublic(
    st.session,
    st.day,
    {
      service: extra.service ?? FREE,
      person: { name, birthDate: extra.birthDate ?? "1990-01-01", cpf: null },
      guardianId: name,
      answers: answers(),
      id: name,
      activeEntries: st.entries,
      acceptedPhoto: extra.acceptedPhoto ?? false,
    },
    now,
  );
  const { entry: e, session, day } = apply(r);
  return { session, day, entries: [...st.entries, e] };
}

const ent = (st: State, id: string): Entry => {
  const e = st.entries.find((x) => x.id === id);
  if (!e) throw new Error(`entrada ${id} não existe`);
  return e;
};

const itemOf = (day: SessionDay | null, entryId: string) => day?.items.find((i) => i.entryId === entryId);

describe("abertura (RN-FILA-01)", () => {
  it("queue: open numbers by original date", () => {
    const joao = entry("joao", { originalEntryDate: T - 5 * DAY });
    const ana = entry("ana", { originalEntryDate: T - 9 * DAY });
    const bruno = entry("bruno", { originalEntryDate: T - DAY });
    let s = sessionSlots();
    const allocated = [joao, ana, bruno].map((e) => {
      const r = apply(allocate(e, s, {}, T));
      s = r.session;
      return r.entry;
    });
    const confirmed = allocated.map((e) => (e.id === "bruno" ? e : apply(confirm(e, s, T))));

    const r = openSession(plannedDay(), s, freeze(confirmed), { service: FREE, acceptedPhotos: [] }, START);
    const { day, entries, session } = apply(r);
    expect(day.state).toBe("open");
    const ia = itemOf(day, "ana");
    const ij = itemOf(day, "joao");
    expect([ia?.number, ia?.ticket, ia?.state]).toEqual([1, "C-001", "remote"]);
    expect([ij?.number, ij?.ticket]).toEqual([2, "C-002"]);
    expect(itemOf(day, "bruno")).toBeUndefined();
    expect(day.nextNumber).toBe(3);
    const b = entries.find((e) => e.id === "bruno");
    expect([b?.state, b?.sessionId]).toEqual(["waiting", null]);
    expect(entries.find((e) => e.id === "ana")?.state).toBe("in_queue");
    expect(session.taken).toBe(2);
  });

  it("RN-FILA-01: abrir só a partir de planejada e só com as confirmadas da sessão", () => {
    const other = entry("x", { state: "confirmed", sessionId: "s2" });
    const my = entry("y", { state: "confirmed", sessionId: "s1" });
    const { day, entries } = apply(open(plannedDay(), freeze([other, my]), START));
    expect(day.items.map((i) => i.entryId)).toEqual(["y"]);
    expect(day.items[0]?.id).toBe(itemIdFor("y", "s1"));
    expect(entries.find((e) => e.id === "x")?.state).toBe("confirmed");
    expect(error(open(day, [], START))).toBe("forbidden_transition");
  });

  it("RN-TRI-01: serviço com triagem abre na etapa de triagem", () => {
    const e = entry("y", { state: "confirmed", sessionId: "s1" });
    const { day } = apply(open(plannedDay({ requiresTriage: true }), freeze([e]), START));
    expect(day.items[0]?.stage).toBe("triage");
  });
});

describe("sessão pública (RN-PUB)", () => {
  const initial = (slots: number | null = 3): State => ({ session: publicOne({ slots }), day: null, entries: [] });

  it("public: patient enrolls without the scheduler and is confirmed", () => {
    const st = signUp(initial(), "ana");
    const ana = ent(st, "ana");
    expect(ana.state).toBe("confirmed");
    expect(ana.sessionId).toBe("s1");
    expect(ana.confirmedRisk).toBeNull(); // RN-RISCO-02: fica sugerido até a triagem
    expect(st.session.taken).toBe(1);
    expect(suggest(st.entries, st.session, DEFAULT_CONFIG, T)).toEqual([]);
    expect(callList(st.entries, [st.session], DEFAULT_CONFIG, T)).toEqual([]);
  });

  it("public: private session, emergency, duplicate and full are refused", () => {
    const cmd = (name: string, extra: Partial<Parameters<typeof signUpPublic>[2]> = {}) => ({
      service: FREE,
      person: { name, birthDate: "1990-01-01", cpf: null },
      guardianId: name,
      answers: answers(),
      id: name,
      activeEntries: [] as Entry[],
      acceptedPhoto: false,
      ...extra,
    });
    expect(error(signUpPublic(sessionSlots(), null, cmd("ana"), T))).toBe("forbidden_transition");
    const emergency = cmd("ana", { answers: answers({ alarms: ["chest_pain"] }) });
    expect(error(signUpPublic(publicOne({ slots: 2 }), null, emergency, T))).toBe("emergency");

    let st = signUp(initial(2), "ana");
    expect(error(signUpPublic(st.session, null, cmd("ana", { id: "ana2", activeEntries: st.entries }), T))).toBe(
      "duplicate",
    );
    st = signUp(st, "joao");
    // RN-PUB-02 (substitui o "lotada" do protótipo): lotada vai para a reserva, sem ocupar vaga.
    st = signUp(st, "bruno");
    expect(ent(st, "bruno").state).toBe("in_reserve");
    expect(st.session.taken).toBe(2);
  });

  it("public: day order follows enrollment time, with priority on top", () => {
    let st = initial(5);
    st = signUp(st, "joao", T);
    st = signUp(st, "bruno", T + MIN);
    st = signUp(st, "dora", T + 2 * MIN, { birthDate: "1950-01-01" });
    const without = { ...DEFAULT_CONFIG, windowK: 0 }; // sem janela protegida, para isolar a ordem
    const r = openSession(
      plannedDay({ config: without }),
      st.session,
      st.entries,
      { service: FREE, acceptedPhotos: [] },
      START,
    );
    let day = apply(r).day;
    expect(day.items.map((i) => [i.entryId, i.number])).toEqual([
      ["joao", 1],
      ["bruno", 2],
      ["dora", 3],
    ]);
    for (const i of day.items) {
      day = apply(verifyAndMark(day, { itemId: i.id, result: "matches" }, START + MIN));
    }
    expect(eligible(day, "e1")[0]?.entryId).toBe("dora"); // idosa passa na frente de quem chegou antes
  });

  it("public: enrolling on the day of an open session enters the queue", () => {
    let st = signUp(initial(5), "joao");
    st = {
      ...st,
      ...apply(openSession(plannedDay(), st.session, st.entries, { service: FREE, acceptedPhotos: [] }, START)),
    };
    st = signUp(st, "ana", START + 10 * MIN);
    expect(ent(st, "ana").state).toBe("in_queue");
    const item = itemOf(st.day, "ana");
    expect(item?.number).toBe(2); // RN-FILA-02: próximo número livre
    expect(item?.state).toBe("remote");
    expect(st.session.taken).toBe(2);
  });

  it("public: referral service reserves the slot until the referral is accepted", () => {
    let st: State = { session: publicOne({ serviceId: "car", slots: 2 }), day: null, entries: [] };
    st = signUp(st, "ana", T, { service: REFERRAL });
    expect(ent(st, "ana").state).toBe("awaiting_referral");
    expect(ent(st, "ana").sessionId).toBe("s1");
    expect(st.session.taken).toBe(1); // a vaga fica guardada (vaga segura)
    const accepted = apply(acceptReferral(ent(st, "ana"), null, T + H));
    expect(accepted.state).toBe("confirmed");
    st = { ...st, entries: st.entries.map((e) => (e.id === "ana" ? accepted : e)) };

    // Sem aceite até a abertura, a vaga segura cai.
    st = signUp(st, "joao", T + 2 * H, { service: REFERRAL });
    const day0 = plannedDay({ serviceId: "car" });
    const r = apply(openSession(day0, st.session, st.entries, { service: REFERRAL, acceptedPhotos: [] }, START));
    const joao = r.entries.find((e) => e.id === "joao");
    expect([joao?.state, joao?.sessionId]).toEqual(["awaiting_referral", null]);
    expect(r.day.items.map((i) => i.entryId)).toEqual(["ana"]);
    expect(r.session.taken).toBe(1);
  });

  it("RN-ENC-04: requisição sem foto aceita com a sessão já aberta é recusada; com foto aceita entra", () => {
    let st: State = { session: publicOne({ serviceId: "car" }), day: null, entries: [] };
    const day0 = plannedDay({ serviceId: "car" });
    st = { ...st, ...apply(openSession(day0, st.session, [], { service: REFERRAL, acceptedPhotos: [] }, START)) };
    const cmd = {
      service: REFERRAL,
      person: { name: "Ana", birthDate: "1990-01-01", cpf: null },
      guardianId: "ana",
      answers: answers(),
      id: "ana",
      activeEntries: [] as Entry[],
      acceptedPhoto: false,
    };
    expect(error(signUpPublic(st.session, st.day, cmd, START + MIN))).toBe("referral_pending");
    st = signUp(st, "ana", START + MIN, { service: REFERRAL, acceptedPhoto: true });
    expect(ent(st, "ana").state).toBe("in_queue");
  });
});

describe("lista de reserva (RN-PUB-02)", () => {
  const fullState = (): State => {
    let st: State = { session: publicOne({ slots: 1 }), day: null, entries: [] };
    st = signUp(st, "ana", T);
    st = signUp(st, "bruno", T + MIN);
    st = signUp(st, "carla", T + 2 * MIN);
    return st;
  };

  it("RN-PUB-02: lotada vai para a reserva; vaga liberada vai ao primeiro", () => {
    const st = fullState();
    expect(["ana", "bruno", "carla"].map((id) => ent(st, id).state)).toEqual(["confirmed", "in_reserve", "in_reserve"]);
    expect(st.session.taken).toBe(1);

    // Ana cancela (o cancelamento é da Task 10); a vaga dela vai para Bruno.
    const withoutAna = st.entries.map((e) => (e.id === "ana" ? { ...e, state: "cancelled" as const } : e));
    const r = fillFromReserve(free(st.session), null, freeze(withoutAna), { service: FREE, acceptedPhotos: [] }, T + H);
    const { entries, session } = apply(r);
    expect(entries.find((e) => e.id === "bruno")?.state).toBe("confirmed");
    expect(entries.find((e) => e.id === "carla")?.state).toBe("in_reserve");
    expect(session.taken).toBe(1);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "signed_up", entryId: "bruno" }));
  });

  it("RN-PUB-02: remanejado de sessão pública fica no topo da reserva", () => {
    const st = fullState();
    const entries = st.entries.map((e) =>
      e.id === "ana"
        ? { ...e, state: "cancelled" as const }
        : e.id === "carla"
          ? { ...e, reassigned: "public" as const }
          : e,
    );
    const { entries: after } = apply(
      fillFromReserve(free(st.session), null, freeze(entries), { service: FREE, acceptedPhotos: [] }, T + H),
    );
    expect(after.find((e) => e.id === "carla")?.state).toBe("confirmed");
  });

  it("RN-PUB-02: com a sessão aberta, a vaga vai para a fila; sem foto passa ao próximo", () => {
    let st: State = { session: publicOne({ serviceId: "car", slots: 1 }), day: null, entries: [] };
    st = signUp(st, "ana", T, { service: REFERRAL, acceptedPhoto: true });
    st = signUp(st, "bruno", T + MIN, { service: REFERRAL });
    st = signUp(st, "carla", T + 2 * MIN, { service: REFERRAL });
    const day0 = plannedDay({ serviceId: "car" });
    st = {
      ...st,
      ...apply(openSession(day0, st.session, st.entries, { service: REFERRAL, acceptedPhotos: [] }, START)),
    };
    const withoutAna = st.entries.map((e) => (e.id === "ana" ? { ...e, state: "cancelled" as const } : e));
    const r = apply(
      fillFromReserve(
        free(st.session),
        st.day,
        freeze(withoutAna),
        { service: REFERRAL, acceptedPhotos: ["carla"] },
        START + H,
      ),
    );
    expect(r.entries.find((e) => e.id === "bruno")?.state).toBe("in_reserve");
    expect(r.entries.find((e) => e.id === "carla")?.state).toBe("in_queue");
    expect(itemOf(r.day, "carla")?.number).toBe(2);
    expect(r.session.taken).toBe(1);
  });

  it("RN-ENC-04: da reserva sem foto, antes da abertura, recebe como vaga segura", () => {
    let st: State = { session: publicOne({ serviceId: "car", slots: 1 }), day: null, entries: [] };
    st = signUp(st, "ana", T, { service: REFERRAL, acceptedPhoto: true });
    st = signUp(st, "bruno", T + MIN, { service: REFERRAL });
    const withoutAna = st.entries.map((e) => (e.id === "ana" ? { ...e, state: "cancelled" as const } : e));
    const r = apply(
      fillFromReserve(free(st.session), null, freeze(withoutAna), { service: REFERRAL, acceptedPhotos: [] }, T + H),
    );
    const bruno = r.entries.find((e) => e.id === "bruno");
    expect([bruno?.state, bruno?.sessionId]).toEqual(["awaiting_referral", "s1"]);
    expect(r.session.taken).toBe(1);
  });

  it("RN-PUB-02: troca de reserva por vaga cancela a reserva", () => {
    const st = fullState();
    const other = publicOne({ id: "s2", start: START + DAY, slots: 2 });
    const r = switchReserve(ent(st, "bruno"), other, null, { service: FREE, acceptedPhoto: false }, T + H);
    const { entry: bruno, session } = apply(r);
    expect([bruno.state, bruno.sessionId]).toEqual(["confirmed", "s2"]);
    expect(bruno.originalEntryDate).toBe(ent(st, "bruno").originalEntryDate);
    expect(session.taken).toBe(1);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "cancelled", entryId: "bruno", sessionId: "s1" }));

    // Só quem está na reserva troca; destino lotado, privado ou de outro serviço não.
    expect(error(switchReserve(ent(st, "ana"), other, null, { service: FREE, acceptedPhoto: false }, T))).toBe(
      "forbidden_transition",
    );
    const full = publicOne({ id: "s2", slots: 1, taken: 1 });
    expect(error(switchReserve(ent(st, "bruno"), full, null, { service: FREE, acceptedPhoto: false }, T))).toBe(
      "no_slot",
    );
    const privateOne = sessionSlots({ id: "s2" });
    expect(error(switchReserve(ent(st, "bruno"), privateOne, null, { service: FREE, acceptedPhoto: false }, T))).toBe(
      "forbidden_transition",
    );
  });

  it("RN-PUB-02: troca para serviço com requisição, sem foto, guarda vaga segura", () => {
    let st: State = { session: publicOne({ serviceId: "car", slots: 1 }), day: null, entries: [] };
    st = signUp(st, "ana", T, { service: REFERRAL, acceptedPhoto: true });
    st = signUp(st, "bruno", T + MIN, { service: REFERRAL });
    const other = publicOne({ id: "s2", serviceId: "car", start: START + DAY });
    const { entry } = apply(
      switchReserve(ent(st, "bruno"), other, null, { service: REFERRAL, acceptedPhoto: false }, T),
    );
    expect([entry.state, entry.sessionId]).toEqual(["awaiting_referral", "s2"]);
  });
});

describe("vaga segura (RN-ENC-04)", () => {
  it("RN-ENC-04: vaga segura sem aceite é liberada na abertura", () => {
    let st: State = { session: publicOne({ serviceId: "car", slots: 1 }), day: null, entries: [] };
    st = signUp(st, "ana", T, { service: REFERRAL }); // vaga segura
    st = signUp(st, "bruno", T + MIN, { service: REFERRAL, acceptedPhoto: true }); // reserva
    const day0 = plannedDay({ serviceId: "car" });
    const r = openSession(day0, st.session, st.entries, { service: REFERRAL, acceptedPhotos: ["bruno"] }, START);
    const { day, entries, session } = apply(r);
    const ana = entries.find((e) => e.id === "ana");
    expect([ana?.state, ana?.sessionId]).toEqual(["awaiting_referral", null]);
    expect(entries.find((e) => e.id === "bruno")?.state).toBe("in_queue");
    expect(day.items.map((i) => i.entryId)).toEqual(["bruno"]);
    expect(session.taken).toBe(1);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "slot_released", entryId: "ana" }));
  });

  it("RN-ENC-04: aceite depois da abertura não vale; fora da vaga segura, aceite volta à lista", () => {
    const safe = entry("a", { serviceId: "car", state: "awaiting_referral", sessionId: "s1" });
    const open = { ...plannedDay(), state: "open" as const };
    expect(error(acceptReferral(safe, freeze(open), START))).toBe("past_deadline");
    const inWaitlist = entry("b", { serviceId: "car", state: "awaiting_referral" });
    expect(apply(acceptReferral(inWaitlist, null, T)).state).toBe("waiting");
    expect(error(acceptReferral(entry("c"), null, T))).toBe("forbidden_transition");
  });
});

describe("balcão (RN-FILA-03, RN-ENC-05)", () => {
  const openDay = (partial: Partial<SessionDay> = {}) => {
    const e = [
      entry("ana", { state: "confirmed", sessionId: "s1" }),
      entry("joao", { state: "confirmed", sessionId: "s1" }),
    ];
    return apply(open(plannedDay(partial), freeze(e), START));
  };
  const cmd = (name: string, extra: Partial<Parameters<typeof includeAtDesk>[1]> = {}) => ({
    service: FREE,
    session: sessionSlots({ taken: 2 }),
    person: { name, birthDate: "1960-05-05", cpf: null },
    answers: answers(),
    id: name,
    activeEntries: [] as Entry[],
    ...extra,
  });

  it("queue: front desk entry is present", () => {
    const { day } = openDay();
    const r = includeAtDesk(day, cmd("ze"), START + MIN);
    const { day: d2, session, entry: ze } = apply(r);
    const item = itemOf(d2, "ze");
    expect([item?.state, item?.number, item?.ticket]).toEqual(["present", 3, "C-003"]);
    // Fila do dia: quem entra pelo balcão já está na unidade; quem entra na abertura, em casa.
    expect(item?.presentSince).toBe(START + MIN);
    expect(d2.items.filter((i) => i.id !== item?.id).map((i) => i.presentSince)).toEqual([null, null]);
    expect(ze.state).toBe("in_queue");
    expect(ze.guardianId).toBeNull(); // pessoa local
    expect(item?.priority.verified).toBe(true); // a recepção conferiu na hora (idoso)
    expect(session.taken).toBe(3);

    expect(error(includeAtDesk(d2, cmd("other", { session }), START + 2 * MIN))).toBe("no_slot");
    const emerg = cmd("x", { session: sessionSlots({ slots: 5 }), answers: answers({ alarms: ["seizure"] }) });
    expect(error(includeAtDesk(d2, emerg, START))).toBe("emergency");
    expect(error(includeAtDesk(plannedDay(), cmd("y"), T))).toBe("session_closed");
  });

  it("RN-FILA-03: a entrada do balcão passa pelo contrato de estados", () => {
    const rows = ENTRY_TRANSITIONS.filter((t) => t.de === "—" && t.event === "Recepção inclui no balcão");
    expect(rows.map((t) => [t.for, t.spec])).toEqual([["in_queue", "marcacao"]]);
    expect(destinationByCondition("—", "Recepção inclui no balcão", () => true)).toBe("in_queue");
  });

  it("RN-ENC-05: balcão recusado em serviço regulado", () => {
    const { day } = openDay({ serviceId: "reg" });
    expect(
      error(includeAtDesk(day, cmd("ze", { service: REGULATED, session: sessionSlots({ serviceId: "reg" }) }), START)),
    ).toBe("regulated_service");
  });
});

describe("lançamento regulado (RN-ENC-06)", () => {
  const privateOne = () => sessionSlots({ serviceId: "reg" });
  const cmd = (extra: Partial<Parameters<typeof registerRegulated>[2]> = {}) => ({
    service: REGULATED,
    id: "ze",
    person: { name: "José", birthDate: "1950-03-03", cpf: "123.456.789-00" },
    accountId: "conta-ze",
    verifiedAccount: true,
    activeEntries: [] as Entry[],
    ...extra,
  });

  it("RN-ENC-06: lançamento entra confirmado; com sessão aberta, direto na fila", () => {
    const r = registerRegulated(privateOne(), null, cmd({ regulationRisk: "attention" }), T);
    const { entry: ze, session } = apply(r);
    expect(ze.state).toBe("confirmed");
    expect(ze.sessionId).toBe("s1");
    expect(ze.confirmedRisk).toBe("attention"); // INV-07: gravado pelo agendador
    expect(ze.allocatedAt).toBeNull(); // sem prazo de confirmação
    expect(ze.guardianId).toBe("conta-ze");
    expect(session.taken).toBe(1);
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "registered", data: { push: true } }));
    expect(callList([ze], [session], DEFAULT_CONFIG, T)).toEqual([]);
    expect(
      apply(
        registerRegulated(
          privateOne(),
          null,
          cmd({ id: "z2", person: { name: "B", birthDate: "1990-01-01", cpf: null } }),
          T,
        ),
      ).entry.confirmedRisk,
    ).toBe("routine");

    // Confirmado do lançamento entra na fila na abertura, sem liberação.
    const day0 = plannedDay({ serviceId: "reg" });
    const open = apply(openSession(day0, session, freeze([ze]), { service: REGULATED, acceptedPhotos: [] }, START));
    expect(itemOf(open.day, "ze")?.number).toBe(1);

    // No dia, com a sessão aberta: direto na fila remota com o próximo número.
    const r2 = registerRegulated(
      open.session,
      open.day,
      cmd({
        id: "ana",
        person: { name: "Ana", birthDate: "1990-01-01", cpf: "999" },
        activeEntries: open.entries,
      }),
      START + H,
    );
    const { entry: ana, day } = apply(r2);
    expect(ana.state).toBe("in_queue");
    const item = itemOf(day, "ana");
    expect([item?.state, item?.number, item?.ticket]).toEqual(["remote", 2, "C-002"]);
  });

  it("RN-ENC-06/RN-CONF-04: lançamento confirmado não é liberado na abertura", () => {
    const { entry: ze, session } = apply(registerRegulated(privateOne(), null, cmd(), T));
    const pend = pendingAtOpening(freeze([ze]), session);
    expect(apply(pend).entries).toEqual([ze]);
    expect(apply(pend).session.taken).toBe(1);
    expect(events(pend)).toEqual([]);
    const day0 = plannedDay({ serviceId: "reg" });
    const ab = apply(openSession(day0, session, freeze([ze]), { service: REGULATED, acceptedPhotos: [] }, START));
    expect(ab.entries[0]?.state).toBe("in_queue");
    expect(ab.session.taken).toBe(1);
    expect(itemOf(ab.day, "ze")?.state).toBe("remote");
  });

  it("RN-ENC-06/RN-FILA-05: lançamento com prioridade a conferir não é liberado; só o check-in espera a recepção", () => {
    // José (76 anos): idoso vem da data de nascimento no dia da sessão (AD-027) e não é pendência (F1).
    const { entry: ze, session } = apply(registerRegulated(privateOne(), null, cmd(), T));
    expect(ze.priority.groups).toEqual([]);
    const day0 = plannedDay({ serviceId: "reg" });
    const r = openSession(day0, session, freeze([ze]), { service: REGULATED, acceptedPhotos: [] }, START);
    const ab = apply(r);
    expect(events(r).some((e) => e.kind === "slot_released")).toBe(false);
    expect([ab.entries[0]?.state, ab.session.taken]).toEqual(["in_queue", 1]);
    const itemZe = itemOf(ab.day, "ze");
    if (!itemZe) throw new Error("José fora da fila");
    expect(itemZe.priority.groups).toEqual(["elderly"]);
    expect(error(checkIn(ab.day, { itemId: itemZe.id }, START + 10 * MIN))).toBe("ok");

    // Com prioridade declarada ainda não conferida (PcD): a pendência só recusa o check-in.
    const disability = freeze({
      ...ze,
      priority: { groups: ["disability" as const], verified: false, verifiedAt: null },
    });
    const ab2 = apply(
      openSession(day0, session, freeze([disability]), { service: REGULATED, acceptedPhotos: [] }, START),
    );
    expect([ab2.entries[0]?.state, ab2.session.taken]).toEqual(["in_queue", 1]);
    expect(error(checkIn(ab2.day, { itemId: itemZe.id }, START + 10 * MIN))).toBe("pending_check");
    const verified = apply(verifyAndMark(ab2.day, { itemId: itemZe.id, result: "matches" }, START + 12 * MIN));
    expect(itemOf(verified, "ze")?.state).toBe("present");
    expect(itemOf(verified, "ze")?.priority.verified).toBe(true);
  });

  it("RN-ENC-06/RN-LE-01: emergência informada pela regulação é recusada (não entra em fila)", () => {
    expect(error(registerRegulated(privateOne(), null, cmd({ regulationRisk: "emergency" }), T))).toBe("emergency");
  });

  it("RN-ENC-06: conta não verificada é tratada como sem app", () => {
    const r = registerRegulated(privateOne(), null, cmd({ verifiedAccount: false }), T);
    const { entry: ze } = apply(r);
    expect(ze.guardianId).toBeNull();
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "registered", data: { push: false } }));
    const withoutAccount = registerRegulated(privateOne(), null, cmd({ accountId: null, verifiedAccount: false }), T);
    expect(apply(withoutAccount).entry.guardianId).toBeNull();
  });

  it("RN-ENC-06: só em serviço regulado, sessão privada, com vaga e sem duplicata", () => {
    expect(error(registerRegulated(sessionSlots(), null, cmd({ service: FREE }), T))).toBe("forbidden_transition");
    expect(error(registerRegulated(sessionSlots({ serviceId: "reg", visibility: "public" }), null, cmd(), T))).toBe(
      "forbidden_transition",
    );
    expect(error(registerRegulated(sessionSlots({ serviceId: "reg", taken: 3 }), null, cmd(), T))).toBe("no_slot");
    const already = apply(registerRegulated(privateOne(), null, cmd(), T)).entry;
    expect(error(registerRegulated(privateOne(), null, cmd({ id: "z2", activeEntries: [already] }), T))).toBe(
      "duplicate",
    );
  });

  it("RN-ENC-06: agendador remove lançamento não chamado, com motivo", () => {
    const { entry: ze, session } = apply(registerRegulated(privateOne(), null, cmd(), T));
    const r = removeRegulatedEntry(ze, session, null, { service: REGULATED, reason: "CPF errado" }, T + H);
    const rem = apply(r);
    expect(rem.entry.state).toBe("cancelled");
    expect(rem.session.taken).toBe(0);
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "removed", reason: "CPF errado", data: { push: true } }),
    );
    expect(events(r)).toContainEqual(expect.objectContaining({ kind: "slot_released" }));

    // Na fila e já chamado: não remove; remoto nunca chamado: sai da fila.
    const day0 = plannedDay({ serviceId: "reg" });
    const ab = apply(openSession(day0, session, freeze([ze]), { service: REGULATED, acceptedPhotos: [] }, START));
    const inQueue = ab.entries[0] as Entry;
    const outside = apply(
      removeRegulatedEntry(inQueue, ab.session, ab.day, { service: REGULATED, reason: "regulação desmarcou" }, START),
    );
    expect(itemOf(outside.day, "ze")?.state).toBe("left_queue");
    const called = freeze({
      ...ab.day,
      calls: [{ itemId: itemIdFor("ze", "s1"), stage: "care" as const, stationId: "e1", at: START }],
    });
    expect(error(removeRegulatedEntry(inQueue, ab.session, called, { service: REGULATED, reason: "x" }, START))).toBe(
      "forbidden_transition",
    );
  });
});

describe("invariantes", () => {
  it("INV-02: nenhum caminho passa das vagas", () => {
    // Pública cheia: inscrição vai para a reserva; liberar só preenche a vaga que abriu.
    let st: State = { session: publicOne({ slots: 1 }), day: null, entries: [] };
    for (const [i, n] of ["a", "b", "c", "d"].entries()) st = signUp(st, n, T + i * MIN);
    expect(st.session.taken).toBe(1);
    const withoutA = st.entries.map((e) => (e.id === "a" ? { ...e, state: "cancelled" as const } : e));
    const lib = apply(
      fillFromReserve(free(st.session), null, freeze(withoutA), { service: FREE, acceptedPhotos: [] }, T + H),
    );
    expect(lib.session.taken).toBe(1);
    expect(lib.entries.filter((e) => e.state === "confirmed")).toHaveLength(1);
    // Troca para sessão cheia, balcão e lançamento sem vaga: recusados.
    const full = publicOne({ id: "s2", slots: 1, taken: 1 });
    expect(error(switchReserve(ent(st, "c"), full, null, { service: FREE, acceptedPhoto: false }, T))).toBe("no_slot");
    expect(
      error(
        registerRegulated(
          sessionSlots({ serviceId: "reg", slots: 1, taken: 1 }),
          null,
          {
            service: REGULATED,
            id: "z",
            person: { name: "Z", birthDate: "1990-01-01", cpf: null },
            accountId: null,
            verifiedAccount: false,
            activeEntries: [],
          },
          T,
        ),
      ),
    ).toBe("no_slot");
    const openDay = freeze({ ...plannedDay(), state: "open" as const });
    expect(
      error(
        includeAtDesk(
          openDay,
          {
            service: FREE,
            session: sessionSlots({ slots: 1, taken: 1 }),
            person: { name: "Z", birthDate: "1990-01-01", cpf: null },
            answers: answers(),
            id: "z",
            activeEntries: [],
          },
          START,
        ),
      ),
    ).toBe("no_slot");
  });

  it("INV-05: senha única na sessão, inclusive para quem entra depois da abertura", () => {
    let st: State = { session: publicOne({ slots: 4 }), day: null, entries: [] };
    st = signUp(st, "a", T);
    st = signUp(st, "b", T + MIN);
    st = {
      ...st,
      ...apply(openSession(plannedDay(), st.session, st.entries, { service: FREE, acceptedPhotos: [] }, START)),
    };
    st = signUp(st, "c", START + MIN); // inscrição no dia
    st = signUp(st, "d", START + 2 * MIN); // última vaga
    st = signUp(st, "e", START + 3 * MIN); // reserva
    const withoutB = st.entries.map((e) => (e.id === "b" ? { ...e, state: "cancelled" as const } : e));
    st = {
      ...st,
      ...apply(
        fillFromReserve(free(st.session), st.day, freeze(withoutB), { service: FREE, acceptedPhotos: [] }, START + H),
      ),
    };
    const withoutC = st.entries.map((e) => (e.id === "c" ? { ...e, state: "cancelled" as const } : e));
    const session = { ...st.session, taken: st.session.taken - 1 };
    const day = st.day as SessionDay;
    const desk = apply(
      includeAtDesk(
        day,
        {
          service: FREE,
          session,
          person: { name: "F", birthDate: "1990-01-01", cpf: null },
          answers: answers(),
          id: "f",
          activeEntries: withoutC,
        },
        START + 2 * H,
      ),
    );
    const tickets = desk.day.items.map((i) => i.ticket);
    expect(tickets).toEqual(["C-001", "C-002", "C-003", "C-004", "C-005", "C-006"]);
    expect(new Set(tickets).size).toBe(tickets.length);
  });

  it("INV-05: id que já tem item na sessão aberta é recusado como duplicada, sem lançar", () => {
    const e = [entry("ana", { state: "confirmed", sessionId: "s1", serviceId: "cli" })];
    const { day } = apply(open(plannedDay(), freeze(e), START));
    const otherPerson = { name: "Outra", birthDate: "1980-01-01", cpf: null };
    // Balcão com id repetido (pessoa diferente, então RN-LE-02 não pega).
    const desk = includeAtDesk(
      day,
      {
        service: FREE,
        session: sessionSlots({ taken: 1 }),
        person: otherPerson,
        answers: answers(),
        id: "ana",
        activeEntries: [],
      },
      START + MIN,
    );
    expect(error(desk)).toBe("duplicate");
    // Inscrição pública no dia com id repetido.
    const pub = signUpPublic(
      publicOne({ taken: 1 }),
      day,
      {
        service: FREE,
        person: otherPerson,
        guardianId: "x",
        answers: answers(),
        id: "ana",
        activeEntries: [],
        acceptedPhoto: false,
      },
      START + MIN,
    );
    expect(error(pub)).toBe("duplicate");
    // Lançamento regulado no dia com id repetido.
    const regulatedDay = apply(
      open(
        plannedDay({ serviceId: "reg" }),
        freeze([entry("ana", { state: "confirmed", sessionId: "s1", serviceId: "reg" })]),
        START,
      ),
    ).day;
    const reg = registerRegulated(
      sessionSlots({ serviceId: "reg", taken: 1 }),
      regulatedDay,
      {
        service: REGULATED,
        id: "ana",
        person: otherPerson,
        accountId: null,
        verifiedAccount: false,
        activeEntries: [],
      },
      START + MIN,
    );
    expect(error(reg)).toBe("duplicate");
  });

  it("ações não alteram o que recebem", () => {
    // Todas as entradas dos testes acima são congeladas; aqui, o caminho completo com estado congelado.
    let st: State = freeze({ session: publicOne({ slots: 1 }), day: null, entries: [] });
    st = signUp(st, "a", T);
    st = signUp(st, "b", T + MIN);
    expect(() =>
      openSession(plannedDay(), freeze(st.session), freeze(st.entries), { service: FREE, acceptedPhotos: [] }, START),
    ).not.toThrow();
  });
});

describe("AD-010: quem entra na fila com a sessão aberta", () => {
  const E1 = { stationId: "e1" };
  const ATTENTION = newProblem("moderate");

  /** Bruno (rotina) inscrito antes, sessão aberta às 07:00 e Bruno chamado às 07:01. */
  function brunoCalled(slots: number): State {
    let st: State = { session: publicOne({ slots }), day: null, entries: [] };
    st = signUp(st, "bruno", T);
    st = {
      ...st,
      ...apply(openSession(plannedDay(), st.session, st.entries, { service: FREE, acceptedPhotos: [] }, START)),
    };
    const brunoItem = itemOf(st.day, "bruno");
    if (!brunoItem || !st.day) throw new Error("Bruno fora da fila");
    let day = apply(checkIn(st.day, { itemId: brunoItem.id }, START));
    day = apply(callNext(day, E1, START + MIN));
    return { ...st, day };
  }

  /** Zé (atenção, antes de Bruno na ordem) se inscreve na sessão aberta. */
  function zeSignsUp(st: State, now: number): State {
    const {
      entry: ze,
      session,
      day,
    } = apply(
      signUpPublic(
        st.session,
        st.day,
        {
          service: FREE,
          person: { name: "Zé", birthDate: "1990-01-01", cpf: null },
          guardianId: "ze",
          answers: ATTENTION,
          id: "ze",
          activeEntries: st.entries,
          acceptedPhoto: false,
        },
        now,
      ),
    );
    return { session, day, entries: [...st.entries, ze] };
  }

  const dayOf = (st: State): SessionDay => {
    if (!st.day) throw new Error("sem dia");
    return st.day;
  };

  it("AD-010: inscrito com a sessão aberta não perde a vez por chamadas anteriores à inscrição (check-in)", () => {
    const st = zeSignsUp(brunoCalled(3), START + H);
    const ze = itemOf(st.day, "ze");
    expect(ze?.number).toBe(2);
    const r = checkIn(dayOf(st), { itemId: itemIdFor("ze", "s1") }, START + 90 * MIN);
    expect(itemOf(apply(r), "ze")).toMatchObject({ state: "present", number: 2 });
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "present", data: expect.objectContaining({ lostTurn: false }) }),
    );
  });

  it("AD-010/RN-SES-02: inscrito com a sessão aberta que não veio é remanejado, não faltoso", () => {
    const st = zeSignsUp(brunoCalled(3), START + H);
    const day = apply(finish(dayOf(st), E1, START + 2 * H));
    const end = apply(
      close(day, st.entries, START + 3 * H, { withoutSignalWithoutContingency: false, origin: "public" }),
    );
    expect(end.day.closing?.noShows).toEqual([]);
    expect(itemOf(end.day, "ze")?.state).toBe("reassigned");
    expect(end.entries.find((e) => e.id === "ze")?.state).toBe("reassigned");
  });

  it("AD-010: vaga da reserva preenchida com a sessão aberta não perde a vez por chamadas anteriores", () => {
    // Uma vaga só: Zé vai para a reserva; Bruno é chamado; a vaga da Carla abre às 08:00.
    let st: State = { session: publicOne({ slots: 2 }), day: null, entries: [] };
    st = signUp(st, "bruno", T);
    st = signUp(st, "carla", T + MIN);
    st = zeSignsUp(st, T + 2 * MIN);
    expect(ent(st, "ze").state).toBe("in_reserve");
    st = {
      ...st,
      ...apply(openSession(plannedDay(), st.session, st.entries, { service: FREE, acceptedPhotos: [] }, START)),
    };
    let day = apply(checkIn(dayOf(st), { itemId: itemIdFor("bruno", "s1") }, START));
    day = apply(callNext(day, E1, START + MIN));
    const withoutCarla = st.entries.map((e) => (e.id === "carla" ? { ...e, state: "cancelled" as const } : e));
    const rs = apply(
      fillFromReserve(free(st.session), day, freeze(withoutCarla), { service: FREE, acceptedPhotos: [] }, START + H),
    );
    expect(rs.entries.find((e) => e.id === "ze")?.state).toBe("in_queue");
    const r = checkIn(dayOf(rs), { itemId: itemIdFor("ze", "s1") }, START + 90 * MIN);
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "present", data: expect.objectContaining({ lostTurn: false }) }),
    );
  });

  it("AD-010: lançamento regulado com a sessão aberta não perde a vez por chamadas anteriores", () => {
    const regulatedDay = plannedDay({
      serviceId: "reg",
      stations: [{ id: "e1", stage: "care", services: ["reg"], open: true, calledItemId: null }],
    });
    const register = (
      s: SessionSlots,
      d: SessionDay | null,
      id: string,
      risk: "routine" | "attention",
      now: number,
      active: Entry[],
    ) =>
      apply(
        registerRegulated(
          s,
          d,
          {
            service: REGULATED,
            id,
            person: { name: id, birthDate: "1990-01-01", cpf: null },
            accountId: null,
            verifiedAccount: false,
            regulationRisk: risk,
            activeEntries: active,
          },
          now,
        ),
      );
    const bruno = register(sessionSlots({ serviceId: "reg" }), null, "bruno", "routine", T, []);
    const ab = apply(
      openSession(
        regulatedDay,
        bruno.session,
        freeze([bruno.entry]),
        { service: REGULATED, acceptedPhotos: [] },
        START,
      ),
    );
    let day = apply(checkIn(ab.day, { itemId: itemIdFor("bruno", "s1") }, START));
    day = apply(callNext(day, E1, START + MIN));
    const ze = register(ab.session, day, "ze", "attention", START + H, ab.entries);
    if (!ze.day) throw new Error("sem dia");
    const r = checkIn(ze.day, { itemId: itemIdFor("ze", "s1") }, START + 90 * MIN);
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "present", data: expect.objectContaining({ lostTurn: false }) }),
    );
  });
});

describe("I1: prioridade montada no dia de cada sessão (AD-024, AD-027, RN-RISCO-04)", () => {
  /** Abre a sessão "s1" com a entrada confirmada e devolve o item dela. */
  const itemInOpening = (e: Entry, now: number, config = DEFAULT_CONFIG) => {
    const conf = freeze({ ...e, state: "confirmed" as const, sessionId: "s1" });
    const r = apply(open(plannedDay({ config }), [conf], now));
    const item = itemOf(r.day, e.id);
    if (!item) throw new Error("sem item");
    return { day: r.day, item };
  };
  /** 13/11/2026 00:30 e 12/11/2026 23:30 em Brasília (UTC-3). */
  const AFTER_MIDNIGHT = Date.UTC(2026, 10, 13, 3, 30);
  const BEFORE_MIDNIGHT = Date.UTC(2026, 10, 13, 2, 30);

  it("AD-027: quem faz 60 anos entre a entrada na lista e a sessão entra como idoso (fuso da unidade)", () => {
    const e = entry("ze", {
      person: { name: "Zé", birthDate: "1966-11-13", cpf: null },
      originalEntryDate: T - 90 * DAY,
    });
    expect(itemInOpening(e, AFTER_MIDNIGHT).item.priority.groups).toEqual(["elderly"]);
    expect(itemInOpening(e, BEFORE_MIDNIGHT).item.priority.groups).toEqual([]);
  });

  it("AD-027: quem faz 80 anos na espera passa a idoso80 (80+ antes dos demais)", () => {
    const e = entry("dora", {
      person: { name: "Dora", birthDate: "1946-11-13", cpf: null },
      priority: { groups: ["disability"], verified: true, verifiedAt: T - 90 * DAY },
    });
    expect(itemInOpening(e, AFTER_MIDNIGHT).item.priority.groups).toEqual(["elderly80", "disability"]);
    expect(itemInOpening(e, BEFORE_MIDNIGHT).item.priority.groups).toEqual(["elderly", "disability"]);
  });

  it("RN-FILA-05/F1: idoso sem outra prioridade faz check-in sem passar na recepção", () => {
    const e = entry("ze", { person: { name: "Zé", birthDate: "1950-01-01", cpf: null } });
    const { day, item } = itemInOpening(e, START);
    expect(item.priority.groups).toEqual(["elderly"]);
    expect(itemOf(apply(checkIn(day, { itemId: item.id }, START + MIN)), "ze")?.state).toBe("present");
  });

  it("AD-024: conferida na recepção, vale nas próximas idas; com prazo, expira e volta a ser conferida", () => {
    const pregnant = entry("bia", { priority: { groups: ["pregnant"], verified: false, verifiedAt: null } });
    const visit1 = itemInOpening(pregnant, START);
    expect(error(checkIn(visit1.day, { itemId: visit1.item.id }, START + MIN))).toBe("pending_check");
    const verified = apply(verifyAndMark(visit1.day, { itemId: visit1.item.id, result: "matches" }, START + 2 * MIN));
    const verifiedItem = itemOf(verified, "bia");
    if (!verifiedItem) throw new Error("sem item");
    const stored = verificationInEntry(pregnant, verifiedItem);
    expect(stored.priority).toEqual({ groups: ["pregnant"], verified: true, verifiedAt: START + 2 * MIN });

    // Próxima ida, 20 dias depois: já conferida, check-in direto.
    const visit2 = itemInOpening(stored, START + 20 * DAY);
    expect(error(checkIn(visit2.day, { itemId: visit2.item.id }, START + 20 * DAY + MIN))).toBe("ok");
    // Com prazo de 30 dias (D5, configuração): na ida de 40 dias depois, expirou.
    const withDeadline = { ...DEFAULT_CONFIG, priorityDeadlines: { pregnant: 30 } };
    const visit3 = itemInOpening(stored, START + 40 * DAY, withDeadline);
    expect(error(checkIn(visit3.day, { itemId: visit3.item.id }, START + 40 * DAY + MIN))).toBe("pending_check");
  });

  it("RN-RISCO-04: prioridade não conferida é retirada da entrada; a idade continua valendo", () => {
    const e = entry("ze", {
      person: { name: "Zé", birthDate: "1950-01-01", cpf: null },
      priority: { groups: ["disability"], verified: false, verifiedAt: null },
    });
    const { day, item } = itemInOpening(e, START);
    const d = apply(verifyAndMark(day, { itemId: item.id, result: "priority_does_not_match" }, START + MIN));
    const after = itemOf(d, "ze");
    if (!after) throw new Error("sem item");
    expect(after.priority.groups).toEqual(["elderly"]);
    expect(verificationInEntry(e, after).priority.groups).toEqual([]);
  });
});

describe("RN-RISCO-03: refazer o questionário", () => {
  const URGENT = newProblem("severe");

  it("RN-RISCO-03: subir para urgente alerta o agendador; emergência orienta o 192", () => {
    const e = entry("ana");
    const r = redoQuestionnaire(e, null, { answers: URGENT }, T);
    expect(apply(r).entry.classification.level).toBe("urgent");
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "scheduler_alert", entryId: "ana", reason: "Problema novo forte" }),
    );
    // Já urgente: não alerta de novo.
    const already = apply(r).entry;
    expect(
      events(redoQuestionnaire(already, null, { answers: URGENT }, T)).some((x) => x.kind === "scheduler_alert"),
    ).toBe(false);
    expect(error(redoQuestionnaire(e, null, { answers: answers({ alarms: ["chest_pain"] }) }, T))).toBe("emergency");
    // Só enquanto espera: entrada final não refaz.
    expect(error(redoQuestionnaire(entry("x", { state: "completed" }), null, { answers: URGENT }, T))).toBe(
      "forbidden_transition",
    );
  });

  it("RN-RISCO-03: na fila do dia, o item remoto passa a usar o risco sugerido novo", () => {
    const conf = entry("ana", { state: "confirmed", sessionId: "s1" });
    const other = entry("bruno", { state: "confirmed", sessionId: "s1", originalEntryDate: T - 30 * DAY });
    const ab = apply(open(plannedDay(), freeze([other, conf]), START));
    const inQueue = ab.entries.find((x) => x.id === "ana") as Entry;
    const r = redoQuestionnaire(inQueue, ab.day, { answers: URGENT }, START + MIN);
    const { day } = apply(r);
    expect(itemOf(day, "ana")).toMatchObject({ risk: "urgent", confirmedUrgency: false });
    expect(events(r)).toContainEqual(
      expect.objectContaining({ kind: "risk_suggested", itemId: itemIdFor("ana", "s1"), data: { level: "urgent" } }),
    );
    // Risco confirmado (agendador ou triagem) vale sobre o sugerido: o item não muda.
    const confirmed = { ...inQueue, confirmedRisk: "routine" as const };
    expect(itemOf(apply(redoQuestionnaire(confirmed, ab.day, { answers: URGENT }, START + MIN)).day, "ana")?.risk).toBe(
      "routine",
    );
    // Presente: segue no lugar com o risco que tinha; só a entrada muda.
    const present = apply(checkIn(ab.day, { itemId: itemIdFor("ana", "s1") }, START + MIN));
    const p = apply(redoQuestionnaire(inQueue, present, { answers: URGENT }, START + 2 * MIN));
    expect(itemOf(p.day, "ana")?.risk).toBe("routine");
    expect(p.entry.classification.level).toBe("urgent");
  });
});

describe("triagem fechada com o atendimento aberto (RN-EST-07)", () => {
  // A triagem fechou (a última estação dela), o atendimento segue.
  const closedTriage = (partial: Partial<SessionDay> = {}) =>
    plannedDay({
      state: "open",
      requiresTriage: true,
      stations: [
        { id: "tri", stage: "triage", services: ["cli"], open: false, calledItemId: null, closedAt: START },
        { id: "e1", stage: "care", services: ["cli"], open: true, calledItemId: null },
      ],
      ...partial,
    });

  it("a sessão não aceita gente nova: inscrição e balcão recusam", () => {
    const day = closedTriage();
    const session = publicOne({ slots: 5 });
    const r = signUpPublic(
      session,
      day,
      {
        service: FREE,
        person: { name: "ana", birthDate: "1990-01-01", cpf: null },
        guardianId: "ana",
        answers: answers(),
        id: "ana",
        activeEntries: [],
        acceptedPhoto: false,
      },
      START + MIN,
    );
    expect(error(r)).toBe("triage_closed");
    const desk = includeAtDesk(
      day,
      {
        service: FREE,
        session: sessionSlots({ taken: 2 }),
        person: { name: "ze", birthDate: "1960-05-05", cpf: null },
        answers: answers(),
        id: "ze",
        activeEntries: [],
      },
      START + MIN,
    );
    expect(error(desk)).toBe("triage_closed");
  });

  it("a reserva espera: a vaga livre não puxa ninguém enquanto a triagem está fechada", () => {
    const day = closedTriage();
    const session = publicOne({ slots: 5 });
    const reserve = [entry("bia", { state: "in_reserve", sessionId: "s1" })];
    const r = apply(fillFromReserve(session, day, reserve, { service: FREE, acceptedPhotos: [] }, START + MIN));
    expect(r.entries).toEqual(reserve);
    expect(r.day).toBe(day);
  });

  it("reaberta a triagem, volta a aceitar", () => {
    const day = closedTriage({
      stations: [
        { id: "tri", stage: "triage", services: ["cli"], open: true, calledItemId: null },
        { id: "e1", stage: "care", services: ["cli"], open: true, calledItemId: null },
      ],
    });
    const reserve = [entry("bia", { state: "in_reserve", sessionId: "s1" })];
    const r = apply(
      fillFromReserve(publicOne({ slots: 5 }), day, reserve, { service: FREE, acceptedPhotos: [] }, START + MIN),
    );
    expect(r.entries[0]?.state).toBe("in_queue");
  });
});
