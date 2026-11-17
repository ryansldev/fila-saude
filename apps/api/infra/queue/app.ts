import {
  cancelEntry,
  estimate,
  fillFromReserve,
  holdsSlot,
  INACTIVE_ENTRY_STATES,
  leaving,
  MAX_PER_ACCOUNT,
  refusalEnds,
} from "@fila-saude/domain";
import type { MyEntry, PublicUnit, ScheduleSession, SignUpInput } from "@fila-saude/schemas/queue";
import { and, asc, count, eq, gt, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import { Attempts } from "infra/auth/attempts";
import type { AuthenticatedPatient } from "infra/auth/patient-session";
import { requireService } from "infra/config/services";
import database from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { municipality } from "infra/database/central/schema/municipality";
import { entry } from "infra/database/municipal/schema/entry";
import { localPerson } from "infra/database/municipal/schema/local-person";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { station } from "infra/database/municipal/schema/station";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDb } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { forService, inSession, readDay, unitConfig } from "./day";
import { type InformedPerson, lockEntry, updateEntry } from "./entries";
import { signUp } from "./sign-up";

const FINAL_STATES = INACTIVE_ENTRY_STATES;
const SCHEDULE_DAYS = 14;
// Estados em que o paciente ainda pode desistir (cancelarEntrada no domínio).
const CANCELLABLE = ["waiting", "awaiting_referral", "allocated", "confirmed", "in_reserve", "in_queue"];

export async function activeMunicipalities() {
  return database
    .select({ slug: municipality.slug, name: municipality.name, uf: municipality.uf })
    .from(municipality)
    .where(eq(municipality.status, "active"))
    .orderBy(asc(municipality.name));
}

// T3.2 / RN-AG-01: sessões públicas de agora até 14 dias, com vagas restantes; nada de paciente.
/** As sessões que a agenda mostra: públicas, com inscrição aberta, de agora até `SCHEDULE_DAYS`. */
const inSchedule = (now: number) =>
  and(
    eq(session.visibility, "public"),
    inArray(session.state, ["planned", "open"]),
    gt(session.end, new Date(now)),
    lt(session.start, new Date(now + SCHEDULE_DAYS * 86400_000)),
    eq(service.active, true),
    isNull(unit.archivedAt),
  );

export async function schedule(db: TenantDb, now: number, unitId?: string): Promise<ScheduleSession[]> {
  const rows = await db
    .select({ s: session, srv: service, u: unit })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(and(inSchedule(now), unitId ? eq(unit.id, unitId) : undefined))
    .orderBy(asc(session.start));
  return rows.map(({ s, srv, u }) => ({
    id: s.id,
    unit: { id: u.id, name: u.name, neighborhood: u.neighborhood, timeZone: u.timeZone },
    service: { id: srv.id, name: srv.name },
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    professional: s.professional,
    remainingSlots: s.slots === null ? null : Math.max(0, s.slots - s.taken),
    state: s.state as "planned" | "open",
  }));
}

/** Lançada para desfazer a verificação (nada é gravado). */
class OnlyCheck extends Error {}

/**
 * Verifica a inscrição sem gravar, na escolha de "para quem" (antes do questionário): sessão,
 * limite da conta, CPF e duplicada respondem já, com o mesmo código da inscrição de verdade.
 */
export async function checkSignUp(
  db: TenantDb,
  p: AuthenticatedPatient,
  sessionId: string,
  forWhom: SignUpInput["forWhom"],
  now: number,
) {
  const neutral: SignUpInput["answers"] = {
    alarms: [],
    reason: "follow_up",
    severity: null,
    conditions: [],
    groups: [],
  };
  try {
    await db.transaction(async (tx) => {
      await signUpPatient(tx as unknown as TenantDb, p, sessionId, { forWhom, answers: neutral }, now);
      throw new OnlyCheck();
    });
  } catch (err) {
    if (!(err instanceof OnlyCheck)) throw err;
  }
  return { ok: true as const };
}

// Tela 5 / RN-AG-01: as unidades do município (sem as removidas), para o mapa e a lista "perto de você".
export async function municipalityUnits(db: TenantDb, now: number): Promise<PublicUnit[]> {
  const rows = await db.select().from(unit).where(isNull(unit.archivedAt)).orderBy(asc(unit.name));
  const counts = await db
    .select({ unitId: unit.id, n: count() })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(inSchedule(now))
    .groupBy(unit.id);
  const byUnit = new Map(counts.map((c) => [c.unitId, c.n]));
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    kind: u.kind,
    address: { street: u.street, number: u.number, neighborhood: u.neighborhood, postalCode: u.postalCode },
    lat: u.lat,
    lng: u.lng,
    appointments: byUnit.get(u.id) ?? 0,
    timeZone: u.timeZone,
  }));
}

/**
 * AD-018: "para mim" usa os dados da conta; "outra pessoa" usa os informados, e o CPF de quem
 * tem conta não entra como "outra pessoa" (a própria conta usa "para mim"; quem tem conta entra pela dela).
 */
// RN-ID-07: CPFs de outras pessoas que uma conta informa por hora (inscrição, lista e conferência).
const cpfLookups = new Attempts({ max: 20, windowMs: 3_600_000 });

export async function personFromRequest(
  p: AuthenticatedPatient,
  forWhom: SignUpInput["forWhom"],
): Promise<InformedPerson> {
  if (forWhom.kind === "me") {
    const [account] = await database
      .select({ name: patient.name, birthDate: patient.birthDate, cpf: patient.cpf })
      .from(patient)
      .where(eq(patient.id, p.patientId));
    if (!account) throw new ApiError(401, "not_authenticated");
    return { ...account, patientId: p.patientId };
  }
  const { name, birthDate, cpf, relationship } = forWhom;
  const digits = cpf ? cpf.replace(/\D/g, "") : null;
  if (digits) {
    // RN-ID-07: a resposta diz se o CPF tem conta; sem limite, uma conta varreria CPFs (oráculo).
    const key = `cpf:${p.patientId}`;
    if (cpfLookups.blocked(key, Date.now()))
      throw new ApiError(
        429,
        "too_many_attempts",
        undefined,
        "Muitas pessoas informadas em pouco tempo. Tente de novo mais tarde ou procure a recepção.",
      );
    cpfLookups.count(key, Date.now());
    const [owner] = await database.select({ id: patient.id }).from(patient).where(eq(patient.cpf, digits));
    if (owner?.id === p.patientId)
      throw new ApiError(409, "own_account_cpf", undefined, 'Esse é o seu CPF. Para se inscrever, escolha "para mim".');
    if (owner)
      throw new ApiError(
        409,
        "person_has_account",
        undefined,
        "Essa pessoa já tem conta no Fila Saúde. Ela se inscreve pela própria conta.",
      );
  }
  return { name, birthDate: birthDate, cpf: digits, patientId: null, relationship };
}

// T3.3 / AD-018: "para mim" usa os dados da conta; "outra pessoa" fica com a conta como responsável.
export async function signUpPatient(
  db: TenantDb,
  p: AuthenticatedPatient,
  sessionId: string,
  data: SignUpInput,
  now: number,
) {
  const [s] = await db.select({ visibility: session.visibility }).from(session).where(eq(session.id, sessionId));
  if (!s) throw new ApiError(404, "not_found");
  if (s.visibility !== "public") throw new ApiError(409, "private_session");
  const person = await personFromRequest(p, data.forWhom);
  // RN-ID-07 (enxuto): uma conta não lota a sessão com pessoas inventadas; conferido sob a trava.
  const e = await signUp(db, sessionId, {
    person,
    guardianPatientId: p.patientId,
    answers: data.answers,
    now,
    limitPerAccount: MAX_PER_ACCOUNT,
  });
  return {
    entryId: e.id,
    state: e.state,
    classification: { level: e.classification.level, support: e.classification.support },
  };
}

// T3.4 / INV-06: só as entradas de que a conta é responsável; as finais ficam 12 h para o app mostrar o fim.
export async function mine(db: TenantDb, patientId: string, now: number): Promise<MyEntry[]> {
  const rows = await db
    .select({ e: entry, p: localPerson, s: session, srv: service, u: unit })
    .from(entry)
    .innerJoin(localPerson, eq(entry.localPersonId, localPerson.id))
    .innerJoin(service, eq(entry.serviceId, service.id))
    .innerJoin(unit, eq(service.unitId, unit.id))
    .leftJoin(session, eq(entry.sessionId, session.id))
    .where(
      and(
        eq(entry.guardianPatientId, patientId),
        or(notInArray(entry.state, [...FINAL_STATES]), gt(session.end, new Date(now - 12 * 3600_000))),
      ),
    )
    .orderBy(asc(entry.createdAt));
  // Um dia por sessão (várias pessoas da conta costumam estar na mesma) e só as estações das chamadas.
  const sessionIds = [...new Set(rows.flatMap(({ s }) => (s ? [s.id] : [])))];
  const days = new Map(await Promise.all(sessionIds.map(async (id) => [id, await readDay(db, id)] as const)));
  const stationIds = [...new Set([...days.values()].flatMap((d) => d?.calls.map((c) => c.stationId) ?? []))];
  const stationNames = new Map(
    stationIds.length === 0
      ? []
      : (
          await db.select({ id: station.id, name: station.name }).from(station).where(inArray(station.id, stationIds))
        ).map((x) => [x.id, x.name]),
  );
  const exit: MyEntry[] = [];
  for (const { e, p, s, srv, u } of rows) {
    const day = s ? (days.get(s.id) ?? null) : null;
    const item = day?.items.find((i) => i.entryId === e.id) ?? null;
    const last = item ? day?.calls.findLast((c) => c.itemId === item.id) : undefined;
    exit.push({
      entryId: e.id,
      person: p.name,
      state: e.state,
      service: srv.name,
      unit: u.name,
      session: s ? { id: s.id, start: s.start.toISOString(), end: s.end.toISOString(), state: s.state } : null,
      ticket: item?.ticket ?? null,
      itemState: item?.state ?? null,
      estimate:
        day && item
          ? estimate(day, item.id, now, { manualMode: false })
          : s?.state === "planned"
            ? { kind: "awaiting_start" }
            : null,
      call:
        item?.state === "called" && last
          ? { station: stationNames.get(last.stationId) ?? "", at: new Date(last.at).toISOString() }
          : null,
      pendingChecks: item?.state === "remote" ? item.pendingChecks : [],
      serviceId: srv.id,
      timeZone: u.timeZone,
      forMe: p.patientId === patientId,
      birthDate: p.birthDate,
      refusalEnds: refusalEnds(e),
      canCancel: e.reassigned === null && CANCELLABLE.includes(e.state) && item?.state !== "called",
      stage: item?.stage ?? null,
      triaged: Boolean(item?.attendedInStages.includes("triage")),
      // AD-059: encaminhado = atendido na triagem com o vermelho confirmado; vermelho atendido aqui segue.
      referred: item?.stage === "triage" && item.state === "done_in_stage" && item.risk === "emergency",
      confirmationDeadline:
        e.state === "allocated" && s && e.allocatedAt
          ? new Date(
              Math.min(e.allocatedAt.getTime() + unitConfig(u).confirmationDeadlineHours * 3600_000, s.start.getTime()),
            ).toISOString()
          : null,
      leaveHome:
        item?.state === "remote" &&
        Boolean(day?.leaveHomeNotices.some((a) => a.itemId === item.id && a.stage === item.stage)),
    });
  }
  return exit;
}

// RN-PRES-02: "Vou sair" da conta responsável; presente volta a remoto com o mesmo número.
export async function patientLeaving(db: TenantDb, patientId: string, entryId: string, now: number) {
  const [e] = await db
    .select({ sessionId: entry.sessionId })
    .from(entry)
    .where(and(eq(entry.id, entryId), eq(entry.guardianPatientId, patientId)));
  if (!e?.sessionId) throw new ApiError(404, "not_found");
  return inSession(db, e.sessionId, async (c) => {
    const item = c.day?.items.find((i) => i.entryId === entryId);
    if (!c.day || !item) throw new ApiError(409, "forbidden_transition");
    const r = leaving(c.day, { itemId: item.id }, now);
    if (!r.ok) throw new ApiError(409, r.error);
    return { day: r.state, events: r.events, result: { ticket: item.ticket, itemState: "remote" as const } };
  });
}

// RN-CANC-01..03: "Não vou poder ir", antes ou no dia, só pela conta responsável. Quem tinha vaga a
// libera (e o primeiro da reserva entra, RN-PUB-02); quem cancela perde o lugar.
export async function cancelPatient(db: TenantDb, patientId: string, entryId: string, now: number) {
  const [row] = await db
    .select({ sessionId: entry.sessionId, state: entry.state })
    .from(entry)
    .where(and(eq(entry.id, entryId), eq(entry.guardianPatientId, patientId)));
  if (!row) throw new ApiError(404, "not_found");
  if (!row.sessionId) {
    // Na lista de espera, sem sessão: só cancela.
    return db.transaction(async (tx) => {
      // Trava a entrada: o agendador pode estar alocando esta mesma entrada agora.
      const e = await lockEntry(tx, entryId);
      if (e.sessionId)
        throw new ApiError(409, "forbidden_transition", undefined, "A lista mudou. Atualize e tente de novo.");
      const r = cancelEntry(e, null, null, { service: forService(await requireService(tx, e.serviceId)) }, now);
      if (!r.ok) throw new ApiError(409, r.error);
      await updateEntry(tx, r.state.entry);
      return { state: "cancelled" as const };
    });
  }
  return inSession(db, row.sessionId, async (c) => {
    const e = c.entries.find((x) => x.id === entryId);
    if (!e) throw new ApiError(409, "forbidden_transition");
    const r = cancelEntry(e, holdsSlot(e) ? c.session : null, c.day, { service: c.service }, now);
    if (!r.ok) throw new ApiError(409, r.error);
    const laterSession = r.state.session ?? c.session;
    const entries = c.entries.map((x) => (x.id === entryId ? r.state.entry : x));
    const reserve = fillFromReserve(
      laterSession,
      r.state.day,
      entries,
      { service: c.service, acceptedPhotos: [] },
      now,
    );
    const final = reserve.ok
      ? { day: reserve.state.day, session: reserve.state.session, entries: reserve.state.entries }
      : { day: r.state.day, session: laterSession, entries };
    return { ...final, events: r.events, result: { state: "cancelled" as const } };
  });
}
