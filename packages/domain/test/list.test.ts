import { describe, expect, it } from "vitest";
import {
  activeEntryOf,
  allocate,
  answerStillNeeds,
  archive,
  askStillNeeds,
  callList,
  confirm,
  confirmationDeadline,
  createEntry,
  type Entry,
  entryPriority,
  pendingAtOpening,
  reactivate,
  refuse,
  type Service,
  type SessionSlots,
  suggest,
} from "../src/list.ts";
import { DEFAULT_CONFIG } from "../src/queue.ts";
import type { Result } from "../src/result.ts";
import { answers, entry, freeze, newProblem, sessionSlots } from "./fixtures.ts";

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;
/** 12/11/2026 07:00 em Brasília (UTC-3, sem horário de verão). */
const T = Date.UTC(2026, 10, 12, 10, 0);

const FREE: Service = freeze({ id: "cli", mode: "direct", requiresTriage: false });
const REFERRAL: Service = freeze({ id: "car", mode: "referral", requiresTriage: false });
const REGULATED: Service = freeze({ id: "reg", mode: "regulated", requiresTriage: false });

const person = (name: string, partial: Partial<Entry["person"]> = {}): Entry["person"] => ({
  name,
  birthDate: "1990-01-01",
  cpf: null,
  ...partial,
});

function apply<E>(r: Result<E>): E {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return freeze(r.state);
}

function events<E>(r: Result<E>) {
  if (!r.ok) throw new Error(`ação recusada: ${r.error}`);
  return r.events;
}

const create = (active: Entry[], cmd: Partial<Parameters<typeof createEntry>[1]> = {}, now = T) =>
  createEntry(
    freeze(active),
    {
      service: FREE,
      person: person("Ana"),
      guardianId: "ana",
      answers: answers(),
      id: "nova",
      ...cmd,
    },
    now,
  );

const allocated = (e: Entry, s: SessionSlots, now = T) => apply(allocate(e, s, {}, now));

describe("entrada na lista", () => {
  it("waitlist: one active entry per service (RN-LE-02)", () => {
    const first = apply(create([], { id: "e1" }));
    expect(first.state).toBe("waiting");

    const again = create([first], { id: "e2" });
    expect(again).toEqual({ ok: false, error: "duplicate" });
    expect(activeEntryOf([first], person("Ana"), "cli")?.id).toBe("e1");

    const otherService = apply(create([first], { id: "e3", service: REFERRAL }));
    expect(otherService.serviceId).toBe("car");

    // Finais e arquivadas não contam como ativas.
    for (const state of ["cancelled", "completed", "closed_without_care", "archived"] as const) {
      expect(create([{ ...first, state }], { id: "e4" }).ok).toBe(true);
    }
  });

  it("RN-LE-05: duplicidade pela pessoa atendida (CPF ou nome + nascimento)", () => {
    const withCpf = apply(create([], { id: "e1", person: person("Ana Souza", { cpf: "123.456.789-09" }) }));
    // Mesmo CPF, outro nome e outro responsável: é a mesma pessoa.
    expect(
      create([withCpf], { id: "e2", guardianId: "mae", person: person("Ana S.", { cpf: "12345678909" }) }),
    ).toEqual({ ok: false, error: "duplicate" });
    // CPFs diferentes com o mesmo nome e nascimento: pessoas diferentes.
    expect(create([withCpf], { id: "e3", person: person("Ana Souza", { cpf: "98765432100" }) }).ok).toBe(true);

    const withoutCpf = apply(create([], { id: "e4", person: person("Bebê da Ana", { birthDate: "2026-01-10" }) }));
    // Sem CPF: nome (sem diferença de caixa, acento ou espaços) + nascimento.
    expect(
      create([withoutCpf], {
        id: "e5",
        guardianId: "pai",
        person: person("  bebe da  ANA ", { birthDate: "2026-01-10" }),
      }),
    ).toEqual({ ok: false, error: "duplicate" });
    expect(create([withoutCpf], { id: "e6", person: person("Bebê da Ana", { birthDate: "2026-01-11" }) }).ok).toBe(
      true,
    );
    // Um lado sem CPF: compara nome + nascimento.
    expect(create([withCpf], { id: "e7", person: person("Ana Souza") })).toEqual({ ok: false, error: "duplicate" });
  });

  it("RN-LE-01: serviço regulado recusa entrada pelo app", () => {
    expect(create([], { service: REGULATED })).toEqual({ ok: false, error: "regulated_service" });
  });

  it("RN-LE-01: serviço com requisição entra aguardando encaminhamento", () => {
    expect(apply(create([], { service: REFERRAL })).state).toBe("awaiting_referral");
  });

  it("emergência não cria entrada (mostra 192)", () => {
    expect(create([], { answers: answers({ alarms: ["chest_pain"] }) })).toEqual({
      ok: false,
      error: "emergency",
    });
  });

  it("RN-LE-03/RN-LE-05: grava data original, classificação e prioridade da pessoa atendida", () => {
    const r = create([], {
      id: "e1",
      guardianId: "filha",
      person: person("Dora", { birthDate: "1944-03-01" }),
      answers: newProblem("severe", { groups: ["disability"] }),
    });
    const e = apply(r);
    expect(e).toMatchObject({
      id: "e1",
      serviceId: "cli",
      guardianId: "filha",
      state: "waiting",
      originalEntryDate: T,
      classification: { level: "urgent", rule: "Problema novo forte" },
      confirmedRisk: null,
      // Só os grupos declarados ficam na entrada; idoso vem da data de nascimento em cada uso (AD-027).
      priority: { groups: ["disability"], verified: false, verifiedAt: null },
      reassigned: null,
      refusals: 0,
      sessionId: null,
      allocatedAt: null,
      askedAt: null,
    });
    // Urgente sugerido: alerta ao agendador (tabela da classificação).
    expect(events(r).map((ev) => ev.kind)).toEqual(["entry_created", "scheduler_alert"]);
  });
});

describe("sugestão de alocação", () => {
  const days = (n: number) => T - n * DAY;

  it("allocation: suggestion order and reasons (RN-AL-01, RN-AL-02)", () => {
    const oldRoutine = entry("ana", { originalEntryDate: days(50) });
    const confirmedUrgent = entry("joao", { originalEntryDate: days(10), confirmedRisk: "urgent" });
    const attention = entry("bruno", {
      originalEntryDate: days(5),
      classification: { level: "attention", rule: "Problema novo moderado", support: false },
    });
    const dora = entry("dora", {
      originalEntryDate: days(20),
      person: person("Dora", { birthDate: "1944-03-01" }),
      priority: { groups: ["elderly80"], verified: false, verifiedAt: null },
    });
    const reassigned = entry("edu", { originalEntryDate: days(1), state: "reassigned", reassigned: "private" });
    const mrZe = entry("ze", {
      originalEntryDate: days(90),
      person: person("Seu Zé", { birthDate: "1956-01-01" }),
      priority: { groups: ["elderly"], verified: false, verifiedAt: null },
    });
    const all = freeze([oldRoutine, confirmedUrgent, attention, dora, reassigned, mrZe]);
    const s = sessionSlots({ slots: 10 });

    const suggestion = suggest(all, s, DEFAULT_CONFIG, T);
    // 80+ antes de 60-79 com o mesmo risco, mesmo esperando há menos tempo.
    expect(suggestion.map((x) => x.entryId)).toEqual(["joao", "edu", "bruno", "dora", "ze", "ana"]);
    const reasons = (id: string) => suggestion.find((x) => x.entryId === id)?.reasons ?? [];
    expect(reasons("dora")).toEqual(["rotina sugerido", "pessoa idosa, 82 anos", "espera há 20 dias"]);
    expect(reasons("joao")).toEqual(["urgente confirmado", "espera há 10 dias"]);
    expect(reasons("edu")).toEqual(["rotina sugerido", "remanejada", "espera há 1 dias"]);

    // Município com prioridade legal antes do risco.
    const byPriority = suggest(all, s, { ...DEFAULT_CONFIG, municipalityOrder: "priority" }, T);
    expect(byPriority.map((x) => x.entryId)).toEqual(["joao", "edu", "dora", "ze", "bruno", "ana"]);
  });

  it("RN-AL-02: empate total desempata pela data original e depois pelo id", () => {
    const all = freeze([
      entry("c", { originalEntryDate: days(3) }),
      entry("b", { originalEntryDate: days(5) }),
      entry("a", { originalEntryDate: days(3) }),
    ]);
    expect(suggest(all, sessionSlots(), DEFAULT_CONFIG, T).map((x) => x.entryId)).toEqual(["b", "a", "c"]);
  });

  it("só sugere entradas aguardando ou remanejadas do serviço da sessão", () => {
    const all = freeze([
      entry("ok"),
      entry("outro", { serviceId: "car" }),
      entry("enc", { state: "awaiting_referral" }),
      entry("aloc", { state: "allocated", sessionId: "s2" }),
      entry("arq", { state: "archived" }),
      entry("refused", { refusedSessions: ["s1"] }),
    ]);
    expect(suggest(all, sessionSlots(), DEFAULT_CONFIG, T).map((x) => x.entryId)).toEqual(["ok"]);
  });
});

describe("alocação", () => {
  it("allocation: never exceeds slots (RN-AL-06, INV-02)", () => {
    const full = sessionSlots({ slots: 3, taken: 3 });
    expect(allocate(entry("a"), full, {}, T)).toEqual({ ok: false, error: "no_slot" });

    const r = apply(allocate(entry("a"), sessionSlots({ slots: 3, taken: 2 }), {}, T));
    expect(r.session.taken).toBe(3);
    expect(allocate(entry("b"), r.session, {}, T)).toEqual({ ok: false, error: "no_slot" });

    // Sem limite de vagas configurado.
    expect(allocate(entry("a"), sessionSlots({ slots: null, taken: 500 }), {}, T).ok).toBe(true);
  });

  it("RN-RISCO-01 (2026-11-13): alocar não confirma o risco; só o enfermeiro confirma (o questionário é pré-triagem)", () => {
    const s = sessionSlots();
    const r = allocate(entry("a"), s, {}, T);
    const { entry: e, session } = apply(r);
    expect(e).toMatchObject({ state: "allocated", sessionId: "s1", allocatedAt: T, confirmedRisk: null });
    expect(session.taken).toBe(1);
    expect(events(r)).toEqual([{ kind: "allocated", entryId: "a", sessionId: "s1", data: { deadline: T + 24 * H } }]);
    // Confirmado antes por enfermeiro (triagem) é mantido.
    expect(apply(allocate(entry("c", { confirmedRisk: "urgent" }), s, {}, T)).entry.confirmedRisk).toBe("urgent");
  });

  it("remanejada pode ser alocada; outros estados e outro serviço não", () => {
    const s = sessionSlots();
    expect(allocate(entry("r", { state: "reassigned", reassigned: "private" }), s, {}, T).ok).toBe(true);
    for (const state of ["allocated", "confirmed", "awaiting_referral", "archived", "cancelled"] as const) {
      expect(allocate(entry("x", { state }), s, {}, T)).toEqual({ ok: false, error: "forbidden_transition" });
    }
    expect(allocate(entry("x", { serviceId: "car" }), s, {}, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(allocate(entry("x"), sessionSlots({ visibility: "public" }), {}, T)).toEqual({
      ok: false,
      error: "forbidden_transition",
    });
  });

  it("RN-AL-05: aloca até as 23:59 da véspera no fuso; às 00:00 do dia da sessão, não", () => {
    const s = sessionSlots(); // 13/11 07:00 em Brasília
    const eve2359 = Date.UTC(2026, 10, 13, 2, 59); // 12/11 23:59 em Brasília (13/11 em UTC)
    const day0000 = Date.UTC(2026, 10, 13, 3, 0); // 13/11 00:00 em Brasília
    expect(allocate(entry("a"), s, {}, eve2359).ok).toBe(true);
    expect(allocate(entry("a"), s, {}, day0000)).toEqual({ ok: false, error: "past_deadline" });
    expect(allocate(entry("a"), s, {}, s.start + H)).toEqual({ ok: false, error: "past_deadline" });
    // Outro fuso: em Manaus (UTC-4) ainda são 23:00 da véspera às 03:00 UTC.
    const manaus = { ...DEFAULT_CONFIG, timeZone: "America/Manaus" };
    const sManaus = sessionSlots({ start: Date.UTC(2026, 10, 13, 11, 0) });
    expect(allocate(entry("a"), sManaus, {}, day0000, manaus).ok).toBe(true);
    expect(allocate(entry("a"), sManaus, {}, Date.UTC(2026, 10, 13, 4, 0), manaus)).toEqual({
      ok: false,
      error: "past_deadline",
    });
  });
});

describe("confirmação", () => {
  it("calllist: pending allocation highlighted after 24 h (RN-CONF-01, RN-CONF-03)", () => {
    const s = sessionSlots({ start: T + 3 * DAY });
    const { entry: e, session } = allocated(entry("ana"), s);
    expect(confirmationDeadline(e, session, DEFAULT_CONFIG)).toBe(T + 24 * H);

    const list = (now: number, entries = [e]) => callList(entries, [session], DEFAULT_CONFIG, now);
    expect(list(T)).toEqual([{ entryId: "ana", sessionId: "s1", deadline: T + 24 * H, highlighted: false }]);
    expect(list(T + 24 * H - MIN)[0]?.highlighted).toBe(false);
    expect(list(T + 24 * H)[0]?.highlighted).toBe(true);

    // Depois das 24 h, ainda dá para confirmar até a abertura (o agendador liga).
    const conf = confirm(e, session, T + 24 * H);
    const confirmed = apply(conf);
    expect(confirmed.state).toBe("confirmed");
    expect(events(conf)).toEqual([{ kind: "confirmed", entryId: "ana", sessionId: "s1" }]);
    expect(list(T + 24 * H, [confirmed])).toEqual([]);
  });

  it("calllist: deadline is the session start when it comes before 24 h", () => {
    const start = Date.UTC(2026, 10, 13, 8, 0); // 13/11 05:00 em Brasília
    const s = sessionSlots({ start });
    const allocatedAtTime = Date.UTC(2026, 10, 13, 1, 0); // 12/11 22:00 em Brasília (véspera)
    const { entry: e, session } = allocated(entry("ana"), s, allocatedAtTime);
    expect(confirmationDeadline(e, session, DEFAULT_CONFIG)).toBe(start);
    const list = (now: number) => callList([e], [session], DEFAULT_CONFIG, now)[0]?.highlighted;
    expect(list(start - MIN)).toBe(false);
    expect(list(start)).toBe(true);
  });

  it("RN-CONF-03: lista de ligação só tem alocadas, pela sessão mais próxima", () => {
    const near = sessionSlots({ id: "perto", start: T + 2 * DAY });
    const far = sessionSlots({ id: "longe", start: T + 5 * DAY });
    const a = allocated(entry("a"), far).entry;
    const b = allocated(entry("b"), near).entry;
    const list = callList(freeze([a, b, entry("c")]), [far, near], DEFAULT_CONFIG, T);
    expect(list.map((x) => x.entryId)).toEqual(["b", "a"]);
  });

  it("confirmar: só alocada nesta sessão e antes da abertura", () => {
    const { entry: e, session } = allocated(entry("a"), sessionSlots());
    expect(confirm(e, session, session.start - 1).ok).toBe(true);
    expect(confirm(e, session, session.start)).toEqual({ ok: false, error: "past_deadline" });
    expect(confirm(entry("x"), session, T)).toEqual({ ok: false, error: "forbidden_transition" });
    expect(confirm(e, sessionSlots({ id: "s2" }), T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("allocation: refusal keeps original date (RN-CONF-04, INV-09)", () => {
    const original = T - 30 * DAY;
    const s = sessionSlots();
    const { entry: e, session } = allocated(entry("ana", { originalEntryDate: original }), s);
    expect(session.taken).toBe(1);

    const r = refuse(e, session, T);
    const after = apply(r);
    expect(after.entry).toMatchObject({
      state: "waiting",
      sessionId: null,
      allocatedAt: null,
      originalEntryDate: original,
      refusedSessions: ["s1"],
    });
    expect(after.session.taken).toBe(0);
    expect(events(r).map((ev) => ev.kind)).toEqual(["refused", "slot_released"]);

    // Volta à lista, mas não é sugerida de novo para a mesma sessão; para outra, sim.
    const other = freeze([after.entry, entry("bruno", { originalEntryDate: T })]);
    expect(suggest(other, after.session, DEFAULT_CONFIG, T).map((x) => x.entryId)).toEqual(["bruno"]);
    expect(suggest(other, sessionSlots({ id: "s9" }), DEFAULT_CONFIG, T)[0]?.entryId).toBe("ana");

    expect(refuse(entry("x"), session, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });

  it("RN-REM-03: remanejada recusa 1ª vez continua remanejada; 2ª vez perde a preferência", () => {
    const s = sessionSlots();
    const rem = entry("r", { state: "reassigned", reassigned: "private" });
    const first = apply(refuse(allocated(rem, s).entry, allocated(rem, s).session, T));
    expect(first.entry).toMatchObject({ state: "reassigned", reassigned: "private", refusals: 1 });
    expect(first.session.taken).toBe(0);

    const second = apply(refuse(allocated(first.entry, s).entry, allocated(first.entry, s).session, T));
    expect(second.entry).toMatchObject({ state: "waiting", reassigned: null, refusals: 2 });

    const publicOne = { ...first.entry, reassigned: "public" as const };
    const r = refuse(allocated(publicOne, s).entry, allocated(publicOne, s).session, T);
    expect(apply(r).entry.state).toBe("cancelled");
    expect(events(r).find((ev) => ev.kind === "cancelled")?.reason).toBe("inscreva-se de novo");
  });
});

describe("abertura da sessão", () => {
  it("RN-CONF-04: alocação pendente na abertura volta à lista com a data original", () => {
    const s = sessionSlots();
    const original = T - 40 * DAY;
    const p1 = allocated(entry("pend", { originalEntryDate: original }), s);
    const p2 = allocated(entry("conf"), p1.session);
    const conf = apply(confirm(p2.entry, p2.session, T));
    const otherSession = { ...allocated(entry("out"), sessionSlots({ id: "s2" })).entry };
    const all = freeze([p1.entry, conf, otherSession, entry("list")]);

    const r = pendingAtOpening(all, p2.session);
    const { entries, session } = apply(r);
    const by = (id: string) => entries.find((e) => e.id === id);
    expect(by("pend")).toMatchObject({
      state: "waiting",
      sessionId: null,
      allocatedAt: null,
      originalEntryDate: original,
    });
    expect(by("conf")).toEqual(conf);
    expect(by("out")).toEqual(otherSession);
    expect(by("list")).toEqual(entry("list"));
    expect(session.taken).toBe(1);
    expect(events(r)).toEqual([
      { kind: "slot_released", entryId: "pend", sessionId: "s1", reason: "sessão abriu sem confirmação" },
    ]);
  });
});

describe("lista parada", () => {
  const cfg = DEFAULT_CONFIG;
  const base = entry("a", { originalEntryDate: T });

  it("RN-PARADA-01: pergunta 'ainda precisa?' a cada 30 dias na lista", () => {
    expect(askStillNeeds(base, cfg, T + 30 * DAY - 1)).toEqual({ ok: false, error: "past_deadline" });
    const r = askStillNeeds(base, cfg, T + 30 * DAY);
    const asked = apply(r);
    expect(asked).toMatchObject({ state: "waiting", askedAt: T + 30 * DAY });
    expect(events(r)).toEqual([{ kind: "still_needs", entryId: "a" }]);
    // Com a pergunta sem resposta, não pergunta de novo.
    expect(askStillNeeds(asked, cfg, T + 61 * DAY)).toEqual({ ok: false, error: "past_deadline" });
    // Respondeu: a próxima é 30 dias depois da resposta.
    const answered = apply(answerStillNeeds(asked, T + 32 * DAY));
    expect(askStillNeeds(answered, cfg, T + 62 * DAY - 1).ok).toBe(false);
    expect(askStillNeeds(answered, cfg, T + 62 * DAY).ok).toBe(true);
    expect(askStillNeeds(entry("x", { state: "allocated" }), cfg, T + 90 * DAY)).toEqual({
      ok: false,
      error: "forbidden_transition",
    });
  });

  it("RN-PARADA: 7 dias sem resposta arquiva; reativa até 30 dias", () => {
    const askedAt = T + 30 * DAY;
    const asked = apply(askStillNeeds(base, cfg, askedAt));
    expect(archive(asked, cfg, askedAt + 7 * DAY - 1)).toEqual({ ok: false, error: "past_deadline" });
    // Respondida a tempo: não arquiva.
    const answered = apply(answerStillNeeds(asked, askedAt + DAY));
    expect(archive(answered, cfg, askedAt + 7 * DAY)).toEqual({ ok: false, error: "past_deadline" });

    const archivedAt = askedAt + 7 * DAY;
    const r = archive(asked, cfg, archivedAt);
    const archived = apply(r);
    expect(archived).toMatchObject({ state: "archived", archivedAt });
    expect(events(r)).toEqual([{ kind: "archived", entryId: "a" }]);

    const back = apply(reactivate([], archived, FREE, archivedAt + 30 * DAY));
    expect(back).toMatchObject({ state: "waiting", originalEntryDate: T, archivedAt: null });
    // A reativação vale como resposta: não pergunta nem arquiva logo em seguida.
    expect(archive(back, cfg, archivedAt + 30 * DAY).ok).toBe(false);
    expect(askStillNeeds(back, cfg, archivedAt + 30 * DAY).ok).toBe(false);

    expect(reactivate([], archived, FREE, archivedAt + 30 * DAY + 1)).toEqual({ ok: false, error: "past_deadline" });
    // Serviço virou regulado (RN-ENC-07).
    expect(reactivate([], archived, { ...FREE, mode: "regulated" }, archivedAt + DAY)).toEqual({
      ok: false,
      error: "regulated_service",
    });
    // Nova entrada ativa da mesma pessoa no serviço enquanto estava arquivada (INV-01).
    expect(reactivate([entry("nova")], { ...archived, person: entry("nova").person }, FREE, archivedAt)).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect(reactivate([], base, FREE, T)).toEqual({ ok: false, error: "forbidden_transition" });
  });
});

describe("I1: idade na lista de espera (AD-027)", () => {
  it("AD-027: a prioridade da entrada usa a idade de agora, não a da criação", () => {
    // Criada aos 59 anos; a sugestão de 30 dias depois já mostra 60.
    const created = apply(
      createEntry(
        [],
        {
          service: FREE,
          person: person("Zé", { birthDate: "1966-11-20" }),
          guardianId: "ze",
          answers: answers(),
          id: "ze",
        },
        T,
      ),
    );
    expect(entryPriority(created, T, DEFAULT_CONFIG.timeZone).groups).toEqual([]);
    const after = T + 30 * DAY;
    expect(entryPriority(created, after, DEFAULT_CONFIG.timeZone).groups).toEqual(["elderly"]);
    const other = entry("ana", { originalEntryDate: T - DAY });
    const suggestion = suggest(freeze([other, created]), sessionSlots({ slots: 5 }), DEFAULT_CONFIG, after);
    expect(suggestion.map((s) => s.entryId)).toEqual(["ze", "ana"]);
    expect(suggestion[0]?.reasons).toContain("pessoa idosa, 60 anos");
  });
});
