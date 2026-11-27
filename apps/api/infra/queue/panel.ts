import {
  type Action,
  close,
  entryOutcome,
  firstName,
  hasPriority,
  type ItemState,
  openSession,
  type SessionDay,
  sameDay,
  sessionOrigin,
  verificationInEntry,
  verifyAndMark,
} from "@fila-saude/domain";
import type { QueueItem, SessionQueue, TodayInUnit, TodayQueue } from "@fila-saude/schemas/queue";
import { and, asc, count, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { requireUnit, SESSION } from "infra/config/common";
import { forSession, requireSession } from "infra/config/sessions";
import database from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { entry } from "infra/database/municipal/schema/entry";
import { localPerson } from "infra/database/municipal/schema/local-person";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { station } from "infra/database/municipal/schema/station";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { conditionsInUnit } from "infra/panel/guard";
import { buildDay, inSession, readDay } from "./day";

// "52998224725" → "•••.982.247-••": o bastante para conferir com o documento sem expor o CPF inteiro.
const maskedCpf = (cpf: string | null) => (cpf ? `•••.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-••` : null);

type EntryData = Pick<QueueItem, "name" | "document" | "guardian">;

/**
 * Numa consulta só (entrada ⋈ pessoa local), o que a Fila do dia mostra de cada pessoa: nome, documento para
 * conferir e, quando outra conta inscreveu, o primeiro nome dela (do banco central) e a relação (2026-11-16).
 */
async function entryData(db: TenantDatabase, ids: string[]): Promise<Map<string, EntryData>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: entry.id,
      name: localPerson.name,
      birthDate: localPerson.birthDate,
      cpf: localPerson.cpf,
      owner: localPerson.patientId,
      guardianId: entry.guardianPatientId,
      relationship: entry.guardianRelationship,
    })
    .from(entry)
    .innerJoin(localPerson, eq(entry.localPersonId, localPerson.id))
    .where(inArray(entry.id, ids));
  // Outra conta inscreveu quando quem inscreveu não é a própria pessoa atendida.
  const fromOtherAccount = (l: (typeof rows)[number]) => l.guardianId !== null && l.guardianId !== l.owner;
  const accountIds = [...new Set(rows.filter(fromOtherAccount).map((l) => l.guardianId as string))];
  const accounts =
    accountIds.length === 0
      ? []
      : await database
          .select({ id: patient.id, name: patient.name })
          .from(patient)
          .where(inArray(patient.id, accountIds));
  const names = new Map(accounts.map((c) => [c.id, firstName(c.name)]));
  return new Map(
    rows.map((l) => {
      const forWhom = fromOtherAccount(l) ? names.get(l.guardianId as string) : undefined;
      return [
        l.id,
        {
          name: l.name,
          document: { birthDate: l.birthDate, cpf: maskedCpf(l.cpf) },
          guardian: forWhom ? { name: forWhom, relationship: l.relationship } : null,
        },
      ];
    }),
  );
}

export async function entryNames(db: TenantDatabase, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: entry.id, name: localPerson.name })
    .from(entry)
    .innerJoin(localPerson, eq(entry.localPersonId, localPerson.id))
    .where(inArray(entry.id, ids));
  return new Map(rows.map((l) => [l.id, l.name]));
}

async function forQueue(
  db: TenantDatabase,
  sessionId: string,
  day: SessionDay | null,
  documents: boolean,
): Promise<SessionQueue> {
  const { s } = await requireSession(db, sessionId);
  const items = day?.items ?? [];
  const data = await entryData(
    db,
    items.map((i) => i.entryId),
  );
  const [reserve] = await db
    .select({ n: count() })
    .from(entry)
    .where(and(eq(entry.sessionId, sessionId), eq(entry.state, "in_reserve")));
  const inReserve = reserve?.n ?? 0;
  return {
    session: await forSession(db, s),
    items: items.map((i) => ({
      id: i.id,
      entryId: i.entryId,
      ticket: i.ticket,
      name: data.get(i.entryId)?.name ?? "",
      stage: i.stage,
      state: i.state,
      skips: i.skips,
      risk: i.risk,
      priority: hasPriority(i.priority),
      stationId: day?.stations.find((e) => e.calledItemId === i.id)?.id ?? null,
      pendingChecks: i.pendingChecks,
      // RN-PERF-01: documento e quem inscreveu (dado de outra conta) só para quem pode ver documentos.
      document: documents ? (data.get(i.entryId)?.document ?? null) : null,
      guardian: documents ? (data.get(i.entryId)?.guardian ?? null) : null,
    })),
    reserve: inReserve,
  };
}

// Qualquer pessoa da equipe com papel na unidade (ou no município) vê a fila do dia (decisão F1).
export async function sessionQueue(ctx: ActionContext, sessionId: string): Promise<SessionQueue> {
  const { service } = await requireSession(ctx.db, sessionId);
  await fromUnitStaff(ctx, service.unitId);
  return forQueue(ctx.db, sessionId, await readDay(ctx.db, sessionId), seesDocuments(ctx, service.unitId));
}

// T3.4 / PD-33: abertura por botão; o worker chama a mesma função depois.
export async function openDaySession(ctx: ActionContext, sessionId: string): Promise<SessionQueue> {
  const { service } = await requireSession(ctx.db, sessionId);
  return runAction(
    ctx,
    {
      action: SESSION,
      target: { kind: "session", id: sessionId },
      unitId: service.unitId,
      data: () => ({ event: "open" }),
    },
    async (tx) => {
      const day = await inSession(tx, sessionId, async (c) => {
        if (c.row.state !== "planned") throw new ApiError(409, "forbidden_transition");
        const r = openSession(
          c.day ?? (await buildDay(tx, sessionId)),
          c.session,
          c.entries,
          { service: c.service, acceptedPhotos: [] },
          ctx.now,
        );
        if (!r.ok) throw new ApiError(409, r.error);
        return {
          day: r.state.day,
          session: r.state.session,
          entries: r.state.entries,
          events: r.events,
          result: r.state.day,
        };
      });
      return forQueue(tx, sessionId, day, seesDocuments(ctx, service.unitId));
    },
  );
}

// T3.9 / RN-SES-01..03: encerrar só sem estação com chamado; remanejados e faltas pelo domínio.
export async function closeDaySession(ctx: ActionContext, sessionId: string): Promise<SessionQueue> {
  const { service } = await requireSession(ctx.db, sessionId);
  return runAction(
    ctx,
    {
      action: SESSION,
      target: { kind: "session", id: sessionId },
      unitId: service.unitId,
      data: () => ({ event: "close" }),
    },
    async (tx) => {
      const day = await inSession(tx, sessionId, async (c) => {
        if (c.day?.state !== "open") throw new ApiError(409, "forbidden_transition");
        const r = close(c.day, c.entries, ctx.now, {
          withoutSignalWithoutContingency: false,
          origin: sessionOrigin(c.session, c.service),
        });
        if (!r.ok) throw new ApiError(409, r.error);
        return { day: r.state.day, entries: r.state.entries, result: r.state.day };
      });
      return forQueue(tx, sessionId, day, seesDocuments(ctx, service.unitId));
    },
  );
}

// RN-FILA-05 / RN-ID-05: a recepção confere e marca a presença na mesma ação (quem teve o QR recusado).
// A conferência fica: o dono da conta fica verificado na central; outra pessoa, conferida na unidade.
export async function markAttendanceInQueue(
  ctx: ActionContext,
  sessionId: string,
  data: {
    entryId: string;
    result: "matches" | "does_not_match" | "priority_does_not_match";
    reason?: string | undefined;
  },
  municipalityId: string | null = null,
): Promise<SessionQueue> {
  const { service } = await requireSession(ctx.db, sessionId);
  let verifiedAccount: string | null = null;
  const queue = await runAction(
    ctx,
    {
      action: "verify_and_mark_attendance",
      target: { kind: "entry", id: data.entryId },
      unitId: service.unitId,
      reason: data.reason ?? null,
      // Recusar a validação tira a pessoa da fila; tirar a prioridade mexe na ordem (RN-PERF-03): com motivo.
      requiresReason: data.result === "does_not_match" || data.result === "priority_does_not_match",
      data: () => ({ result: data.result }),
    },
    async (tx) => {
      const day = await inSession(tx, sessionId, async (c) => {
        const item = c.day?.items.find((i) => i.entryId === data.entryId);
        if (!c.day || !item) throw new ApiError(404, "not_found");
        const cmd = { itemId: item.id, result: data.result, ...(data.reason ? { reason: data.reason } : {}) };
        const r = verifyAndMark(c.day, cmd, ctx.now);
        if (!r.ok) throw new ApiError(409, r.error);
        const entries = c.entries.map((en) => {
          const it = r.state.items.find((i) => i.entryId === en.id);
          if (!it || en.state !== "in_queue") return en;
          // AD-024: a prioridade conferida (ou retirada) fica na entrada e vale nas próximas idas.
          const verified =
            en.id === data.entryId && data.result !== "does_not_match" ? verificationInEntry(en, it) : en;
          const d = entryOutcome(verified, it);
          return d.ok ? d.state : verified;
        });
        return { day: r.state, entries, result: r.state };
      });
      if (data.result !== "does_not_match") {
        const [row] = await tx
          .select({
            personId: localPerson.id,
            patientId: localPerson.patientId,
            guardian: entry.guardianPatientId,
          })
          .from(entry)
          .innerJoin(localPerson, eq(entry.localPersonId, localPerson.id))
          .where(eq(entry.id, data.entryId));
        if (row?.patientId && row.patientId === row.guardian) verifiedAccount = row.patientId;
        else if (row)
          await tx
            .update(localPerson)
            .set({ documentVerifiedBy: ctx.actor.userId, documentVerifiedAt: new Date(ctx.now) })
            .where(eq(localPerson.id, row.personId));
      }
      return forQueue(tx, sessionId, day, seesDocuments(ctx, service.unitId));
    },
  );
  if (verifiedAccount) {
    await database
      .update(patient)
      .set({ verifiedAt: new Date(ctx.now), verificationMethod: "reception", verifiedMunicipality: municipalityId })
      .where(and(eq(patient.id, verifiedAccount), isNull(patient.verifiedAt)));
  }
  return queue;
}

// F1 (revisto): a fila do dia é de quem tem, na unidade, alguma ação dela (como o menu do painel).
export const QUEUE_ACTIONS: Action[] = ["open_cancel_close_session", "verify_and_mark_attendance", "operate_calls"];

/** RN-PERF-01: a recepção e quem agenda veem os documentos; os outros perfis da unidade, não. */
const seesDocuments = (ctx: ActionContext, unitId: string) =>
  conditionsInUnit(ctx.actor.profiles, "view_documents", unitId) !== null;

export async function fromUnitStaff(ctx: ActionContext, unitId: string) {
  for (const action of QUEUE_ACTIONS) {
    if (conditionsInUnit(ctx.actor.profiles, action, unitId) !== null) return;
  }
  throw new ApiError(403, "no_permission");
}

// F1: sessões de hoje (dia local da unidade) e estações, para quem tem ação da fila na unidade.
export async function todayInUnit(ctx: ActionContext, unitId: string): Promise<TodayInUnit> {
  const u = await requireUnit(ctx.db, unitId);
  await fromUnitStaff(ctx, unitId);
  const rows = await ctx.db
    .select({ s: session, service: service.name })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .where(
      and(
        eq(service.unitId, unitId),
        // Sessão aberta de outro dia continua aqui até alguém encerrar (senão ficaria presa).
        or(
          eq(session.state, "open"),
          and(gt(session.end, new Date(ctx.now - 36 * 3600_000)), lt(session.start, new Date(ctx.now + 36 * 3600_000))),
        ),
      ),
    )
    .orderBy(asc(session.start));
  const sessions = [];
  for (const { s, service: name } of rows) {
    if (s.state === "cancelled") continue;
    if (s.state !== "open" && !sameDay(s.start.getTime(), ctx.now, u.timeZone)) continue;
    sessions.push({ ...(await forSession(ctx.db, s)), service: name });
  }
  const stations = await ctx.db
    .select({ id: station.id, name: station.name, stage: station.stage })
    .from(station)
    .where(and(eq(station.unitId, unitId), isNull(station.archivedAt)))
    .orderBy(asc(station.createdAt));
  return { sessions, stations };
}

const iso = (n: number | null | undefined) => (n == null ? null : new Date(n).toISOString());

// Fila do dia, caminho C: as sessões de hoje (as mesmas de `/hoje`) e as pessoas de todas, numa consulta.
export async function todayQueue(ctx: ActionContext, unitId: string): Promise<TodayQueue> {
  const today = await todayInUnit(ctx, unitId);
  const documents = seesDocuments(ctx, unitId);
  const stationName = new Map(today.stations.map((e) => [e.id, e.name]));
  const sessions: TodayQueue["sessions"] = [];
  const items: TodayQueue["items"] = [];
  // As sessões são independentes: lidas em paralelo (a tela consulta a cada poucos segundos).
  const loaded = await Promise.all(
    today.sessions.map(async (s) => {
      const day = await readDay(ctx.db, s.id);
      return { s, day, queue: await forQueue(ctx.db, s.id, day, documents) };
    }),
  );
  for (const { s, day, queue } of loaded) {
    const inStates = (states: ItemState[]) => queue.items.filter((i) => states.includes(i.state)).length;
    sessions.push({
      ...s,
      reserve: queue.reserve,
      counts: {
        inQueue: inStates(["remote", "present", "called"]),
        inUnit: inStates(["present"]),
        onTheWay: inStates(["remote"]),
        called: inStates(["called"]),
        attended: inStates(["done_in_stage"]),
      },
    });
    for (const i of queue.items) {
      const fromDay = day?.items.find((x) => x.id === i.id);
      const call = day?.calls.findLast((c) => c.itemId === i.id);
      const since = i.state === "called" ? iso(call?.at) : i.state === "present" ? iso(fromDay?.presentSince) : null;
      items.push({
        ...i,
        sessionId: s.id,
        service: s.service,
        since,
        station: i.state === "called" && i.stationId ? (stationName.get(i.stationId) ?? null) : null,
      });
    }
  }
  return { now: new Date(ctx.now).toISOString(), sessions, items };
}
