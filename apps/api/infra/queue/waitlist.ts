import { type Answers, activeEntryOf, type Entry, INACTIVE_ENTRY_STATES, redoQuestionnaire } from "@fila-saude/domain";
import type { SignUpInput, UnitService } from "@fila-saude/schemas/queue";
import { and, asc, eq, isNull, notInArray } from "drizzle-orm";
import type { AuthenticatedPatient } from "infra/auth/patient-session";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase, TenantDb } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { MAX_PER_ACCOUNT, personFromRequest } from "./app";
import { inSession, unitConfig } from "./day";
import { joinWaitlist, lockEntry, personByCpf, serviceActiveEntries, updateEntry } from "./entries";
import { answerAllocation } from "./scheduling";

const FINAL_STATES = INACTIVE_ENTRY_STATES;
/** RN-RISCO-03 / AD-060: na lista; na fila do dia, só em casa (`remote`), pela trava da sessão. */
const IN_WAITLIST = ["waiting", "allocated", "confirmed"];

// I1: serviços ativos da unidade (não removida), com o modo de marcação; o app decide o que oferecer.
export async function unitServices(db: TenantDb, unitId: string): Promise<UnitService[]> {
  const rows = await db
    .select({ id: service.id, name: service.name, mode: service.mode })
    .from(service)
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(and(eq(service.unitId, unitId), eq(service.active, true), isNull(unit.archivedAt)))
    .orderBy(asc(service.name));
  return rows;
}

async function activeService(db: TenantDatabase, serviceId: string) {
  const [row] = await db
    .select({ s: service, u: unit })
    .from(service)
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(eq(service.id, serviceId));
  if (!row?.s.active || row.u.archivedAt !== null) throw new ApiError(404, "not_found");
  return row;
}

/**
 * T5.1 / RN-LE-01..05: o paciente entra na lista de espera de um serviço, para si ou para outra pessoa.
 * Serviço com requisição espera a T5.2 (I2); vínculo e pré-cadastro ficam para a fatia 5 (I3).
 * A duplicada só mostra a entrada existente à conta responsável por ela.
 */
export async function joinWaitlistFromApp(
  db: TenantDb,
  p: AuthenticatedPatient,
  serviceId: string,
  data: SignUpInput,
  now: number,
) {
  const person = await personFromRequest(p, data.forWhom);
  return db.transaction(async (tx) => {
    // INV-01 / L-003: trava o serviço para que pedidos simultâneos confiram a duplicada e o limite
    // por conta um depois do outro (a pessoa sem CPF não tem índice único que segure).
    await tx.select({ id: service.id }).from(service).where(eq(service.id, serviceId)).for("update");
    const { s } = await activeService(tx, serviceId);
    if (s.mode === "referral")
      throw new ApiError(
        409,
        "referral_coming_soon",
        undefined,
        "Este serviço pede a requisição do médico. Por enquanto, leve o papel à recepção da unidade.",
      );
    // Como na inscrição: o CPF é conferido antes de dizer se a pessoa já está na lista.
    await personByCpf(tx, person);
    const fromAccount = await tx
      .select({ id: entry.id })
      .from(entry)
      .where(
        and(
          eq(entry.serviceId, serviceId),
          eq(entry.guardianPatientId, p.patientId),
          notInArray(entry.state, [...FINAL_STATES]),
        ),
      );
    if (fromAccount.length >= MAX_PER_ACCOUNT)
      throw new ApiError(
        409,
        "limit_per_account",
        undefined,
        `Uma conta põe até ${MAX_PER_ACCOUNT} pessoas na lista de um serviço. Para mais, procure a recepção.`,
      );
    const r = await joinWaitlist(tx, {
      serviceId,
      person,
      guardianPatientId: p.patientId,
      answers: data.answers,
      now,
    });
    if (!r.ok) {
      if (r.error === "duplicate") {
        const existing = activeEntryOf(await serviceActiveEntries(tx, serviceId), person, serviceId);
        const my = existing?.guardianId === p.patientId;
        throw new ApiError(
          409,
          "duplicate",
          undefined,
          "Essa pessoa já está na lista deste serviço.",
          my ? { entryId: existing.id } : undefined,
        );
      }
      throw new ApiError(409, r.error);
    }
    const e = r.state;
    return {
      entryId: e.id,
      state: e.state,
      classification: { level: e.classification.level, support: e.classification.support },
    };
  });
}

/**
 * RN-RISCO-03 / RN-PIORA-01: a conta responsável refaz o questionário de quem está na lista ou na fila do
 * dia ainda em casa (o risco sugerido sobe na fila). Quem já está na unidade não muda o risco pelo app.
 */
export async function redoPatientQuestionnaire(
  db: TenantDb,
  patientId: string,
  entryId: string,
  answers: Answers,
  now: number,
) {
  const [row] = await db
    .select({ serviceId: entry.serviceId, state: entry.state, sessionId: entry.sessionId })
    .from(entry)
    .where(and(eq(entry.id, entryId), eq(entry.guardianPatientId, patientId)));
  if (!row) throw new ApiError(404, "not_found");
  const answer = (c: Entry["classification"]) => ({ classification: { level: c.level, support: c.support } });
  const { sessionId } = row;
  if (row.state === "in_queue" && sessionId) {
    // Na fila do dia: a trava da sessão vem antes da trava da entrada (mesma ordem de todo caminho).
    return db.transaction((tx) =>
      inSession(tx, sessionId, async (c) => {
        const e = await lockEntry(c.tx, entryId);
        const item = c.day?.items.find((i) => i.entryId === entryId);
        if (e.state !== "in_queue" || item?.state !== "remote") throw new ApiError(409, "forbidden_transition");
        const r = redoQuestionnaire(e, c.day, { answers }, now, unitConfig(c.rowUnit));
        if (!r.ok) throw new ApiError(409, r.error);
        return {
          day: r.state.day,
          entries: [...c.entries.filter((x) => x.id !== e.id), r.state.entry],
          events: r.events,
          result: answer(r.state.entry.classification),
        };
      }),
    );
  }
  return db.transaction(async (tx) => {
    const e = await lockEntry(tx, entryId);
    if (!IN_WAITLIST.includes(e.state)) throw new ApiError(409, "forbidden_transition");
    const { u } = await activeService(tx, row.serviceId);
    const r = redoQuestionnaire(e, null, { answers }, now, unitConfig(u));
    if (!r.ok) throw new ApiError(409, r.error);
    await updateEntry(tx, r.state.entry);
    return answer(r.state.entry.classification);
  });
}

/** RN-CONF-01/04: a conta responsável confirma ou recusa a alocação pelo app. */
export async function patientAnswer(
  db: TenantDb,
  patientId: string,
  entryId: string,
  answer: "confirmed" | "refused",
  now: number,
) {
  const [row] = await db
    .select({ sessionId: entry.sessionId })
    .from(entry)
    .where(and(eq(entry.id, entryId), eq(entry.guardianPatientId, patientId)));
  if (!row) throw new ApiError(404, "not_found");
  const { sessionId } = row;
  if (!sessionId) throw new ApiError(409, "forbidden_transition");
  return db.transaction((tx) => answerAllocation(tx, sessionId, entryId, answer, now));
}
