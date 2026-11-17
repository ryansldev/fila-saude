import {
  type Action,
  ageAt,
  allocate,
  callList,
  confirm,
  confirmationDeadline,
  currentRisk,
  type Entry,
  refuse,
  sameDay,
  suggest,
  type UnitConfig,
} from "@fila-saude/domain";
import type { CallListItem, ServiceWaitlist, SessionAllocation } from "@fila-saude/schemas/queue";
import { and, asc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { requireUnit } from "infra/config/common";
import database from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { audit } from "infra/database/municipal/schema/audit";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase, TenantTx } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { allowed } from "infra/panel/guard";
import { inSession, toSessionSlots, unitConfig } from "./day";
import { lockEntry, readEntry, serviceActiveEntries } from "./entries";

export const SCHEDULE: Action = "allocate_confirm_refuse_for_patient";
const DAY = 86400_000;
const FINAL_STATES = ["cancelled", "completed", "closed_without_care", "archived"] as const;

const MESSAGES: Record<string, string> = {
  no_slot: "A sessão não tem mais vaga. A lista foi atualizada.",
  forbidden_transition: "Essa pessoa já não está disponível para esta sessão. A lista foi atualizada.",
  past_deadline: "A alocação vai até a véspera da sessão.",
  session_closed: "Esta sessão não está mais planejada.",
};

const error409 = (code: string) => new ApiError(409, code, undefined, MESSAGES[code]);

async function requireScheduler(ctx: ActionContext, unitId: string) {
  if (!(await allowed(ctx.actor.profiles, SCHEDULE, unitId))) throw new ApiError(403, "no_permission");
}

async function sessionWithUnit(db: TenantDatabase, sessionId: string) {
  const [row] = await db
    .select({ s: session, srv: service, u: unit })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(eq(session.id, sessionId));
  if (!row) throw new ApiError(404, "not_found");
  return row;
}

/**
 * RN-FALTA-03 / I10: faltas de cada pessoa atendida nos encerramentos da janela do alerta
 * (padrão 2 em 90 dias), pela pessoa local da entrada; sem a regra do titular (RN-ID-06) na v0.1.
 */
async function noShowsByEntry(db: TenantDatabase, entryIds: string[], config: UnitConfig, now: number) {
  const count = new Map<string, number>();
  if (entryIds.length === 0) return count;
  const since = now - config.noShowAlert.days * DAY;
  const days = await db
    .select({ noShows: sql<string[]>`${sessionDay.day}->'encerramento'->'faltas'` })
    .from(sessionDay)
    .where(sql`(${sessionDay.day}->'closing'->>'at')::bigint >= ${since}`);
  const noShow = days.flatMap((d) => (d.noShows ?? []).map((itemId) => itemId.split("/")[1] ?? ""));
  if (noShow.length === 0) return count;
  const people = await db
    .select({ id: entry.id, person: entry.localPersonId })
    .from(entry)
    .where(inArray(entry.id, [...new Set([...noShow, ...entryIds])]));
  const personOf = new Map(people.map((p) => [p.id, p.person]));
  const byPerson = new Map<string, number>();
  for (const f of noShow) {
    const p = personOf.get(f);
    if (p) byPerson.set(p, (byPerson.get(p) ?? 0) + 1);
  }
  for (const id of entryIds) count.set(id, byPerson.get(personOf.get(id) ?? "") ?? 0);
  return count;
}

function canAllocate(
  s: typeof session.$inferSelect,
  config: UnitConfig,
  now: number,
): { canAllocate: boolean; reason: string | null } {
  if (s.state !== "planned") return { canAllocate: false, reason: "A sessão não está mais planejada." };
  if (s.visibility !== "private") return { canAllocate: false, reason: "Sessão pública: o paciente se inscreve." };
  const start = s.start.getTime();
  if (now >= start || sameDay(now, start, config.timeZone))
    return { canAllocate: false, reason: "A alocação vai até a véspera da sessão." };
  if (s.slots !== null && s.taken >= s.slots) return { canAllocate: false, reason: "Sem vagas livres." };
  return { canAllocate: true, reason: null };
}

async function buildAllocation(db: TenantDatabase, sessionId: string, now: number): Promise<SessionAllocation> {
  const { s, srv, u } = await sessionWithUnit(db, sessionId);
  const config = unitConfig(u);
  const slots = toSessionSlots(s);
  const active = await serviceActiveEntries(db, srv.id);
  const inNowSession = active.filter((e) => e.sessionId === sessionId);
  const suggestion = s.visibility === "private" && s.state === "planned" ? suggest(active, slots, config, now) : [];
  const byId = new Map(active.map((e) => [e.id, e]));
  const noShows = await noShowsByEntry(
    db,
    suggestion.map((x) => x.entryId),
    config,
    now,
  );
  const age = (e: Entry) => ageAt(e.person.birthDate, now, config.timeZone);
  return {
    session: {
      id: s.id,
      service: { id: srv.id, name: srv.name },
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      slots: s.slots,
      taken: s.taken,
      state: s.state,
      visibility: s.visibility,
      ...canAllocate(s, config, now),
    },
    allocated: inNowSession
      .sort((a, b) => (a.allocatedAt ?? 0) - (b.allocatedAt ?? 0) || a.originalEntryDate - b.originalEntryDate)
      .map((e) => {
        const deadline = e.state === "allocated" ? confirmationDeadline(e, slots, config) : null;
        return {
          entryId: e.id,
          name: e.person.name,
          age: age(e),
          state: e.state,
          deadline: deadline === null ? null : new Date(deadline).toISOString(),
          highlighted: deadline !== null && now >= deadline,
        };
      }),
    suggestion: suggestion.flatMap(({ entryId, reasons }) => {
      const e = byId.get(entryId);
      if (!e) return [];
      const n = noShows.get(entryId) ?? 0;
      return [
        {
          entryId,
          name: e.person.name,
          age: age(e),
          // O risco já vem em `risco` (selo na tela): os motivos não o repetem.
          reasons: reasons.slice(1),
          alert: e.confirmedRisk === null && e.classification.level === "urgent",
          self_harm: e.classification.support,
          withoutApp: e.guardianId === null,
          noShows: n,
          noShowAlert: n >= config.noShowAlert.noShows,
          risk: { level: currentRisk(e), confirmed: e.confirmedRisk !== null, rule: e.classification.rule },
        },
      ];
    }),
  };
}

// T5.3: a sessão vista pelo agendador da unidade (leitura, sem auditoria).
export async function sessionAllocation(ctx: ActionContext, sessionId: string): Promise<SessionAllocation> {
  const { srv } = await sessionWithUnit(ctx.db, sessionId);
  await requireScheduler(ctx, srv.unitId);
  return buildAllocation(ctx.db, sessionId, ctx.now);
}

/**
 * T5.3 / RN-AL-04..06, INV-08: o agendador aloca uma entrada. Trava a sessão e a entrada; quem
 * chegou depois recebe 409 com a alocação atualizada (I7).
 */
export async function allocateSession(ctx: ActionContext, sessionId: string, entryId: string) {
  const { srv } = await sessionWithUnit(ctx.db, sessionId);
  try {
    await runAction(
      ctx,
      {
        action: SCHEDULE,
        target: { kind: "entry", id: entryId },
        unitId: srv.unitId,
        data: () => ({ event: "allocate", sessionId }),
      },
      (tx) =>
        inSession(tx, sessionId, async (c) => {
          if (c.row.state !== "planned") throw error409("session_closed");
          const e = await lockEntry(c.tx, entryId);
          const r = allocate(e, c.session, {}, ctx.now, unitConfig(c.rowUnit));
          if (!r.ok) throw error409(r.error);
          return {
            session: r.state.session,
            entries: [...c.entries, r.state.entry],
            events: r.events,
            result: null,
          };
        }),
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      err.data = { allocation: await buildAllocation(ctx.db, sessionId, Date.now()) };
    }
    throw err;
  }
  return buildAllocation(ctx.db, sessionId, ctx.now);
}

export type Answer = "confirmed" | "refused" | "no_contact";

/**
 * RN-CONF-01..04: a resposta à alocação, do paciente ou do agendador em nome dele. Confirmar mantém
 * a vaga; recusar a libera e a entrada volta à lista com a data original; "sem contato" só anota (I6).
 */
export async function answerAllocation(
  tx: TenantTx,
  sessionId: string,
  entryId: string,
  answer: Answer,
  now: number,
): Promise<{ state: string }> {
  return inSession(tx, sessionId, async (c) => {
    const e = await lockEntry(c.tx, entryId);
    if (e.sessionId !== sessionId) throw new ApiError(409, "forbidden_transition");
    if (answer === "no_contact") {
      if (e.state !== "allocated") throw new ApiError(409, "forbidden_transition");
      return { result: { state: e.state } };
    }
    const others = c.entries.filter((x) => x.id !== entryId);
    if (answer === "confirmed") {
      const r = confirm(e, c.session, now);
      if (!r.ok) throw new ApiError(409, r.error);
      return { entries: [...others, r.state], events: r.events, result: { state: r.state.state } };
    }
    const r = refuse(e, c.session, now);
    if (!r.ok) throw new ApiError(409, r.error);
    return {
      session: r.state.session,
      entries: [...others, r.state.entry],
      events: r.events,
      result: { state: r.state.entry.state },
    };
  });
}

async function entryWithUnit(db: TenantDatabase, entryId: string) {
  const [row] = await db
    .select({ sessionId: entry.sessionId, unitId: service.unitId })
    .from(entry)
    .innerJoin(service, eq(entry.serviceId, service.id))
    .where(eq(entry.id, entryId));
  if (!row) throw new ApiError(404, "not_found");
  return row;
}

// RN-CONF-02: o agendador registra a resposta depois de ligar.
export async function answerByScheduler(ctx: ActionContext, entryId: string, answer: Answer) {
  const { sessionId, unitId } = await entryWithUnit(ctx.db, entryId);
  await requireScheduler(ctx, unitId);
  if (!sessionId) throw new ApiError(409, "forbidden_transition");
  return runAction(
    ctx,
    {
      action: SCHEDULE,
      target: { kind: "entry", id: entryId },
      unitId,
      data: () => ({ event: "answer", answer, sessionId }),
    },
    (tx) => answerAllocation(tx, sessionId, entryId, answer, ctx.now),
  );
}

// RN-CONF-03: alocações pendentes da unidade, pela sessão mais próxima; com telefone e a última tentativa.
export async function unitCallList(ctx: ActionContext, unitId: string): Promise<CallListItem[]> {
  const u = await requireUnit(ctx.db, unitId);
  await requireScheduler(ctx, unitId);
  const config = unitConfig(u);
  const rows = await ctx.db
    .select({ id: entry.id, sessionId: entry.sessionId })
    .from(entry)
    .innerJoin(service, eq(entry.serviceId, service.id))
    .where(and(eq(service.unitId, unitId), eq(entry.state, "allocated")));
  if (rows.length === 0) return [];
  const entries = (await Promise.all(rows.map((l) => readEntry(ctx.db, l.id)))).filter((e): e is Entry => e !== null);
  const sessionIds = [...new Set(rows.map((l) => l.sessionId).filter((x): x is string => x !== null))];
  const sessions = await ctx.db
    .select({ s: session, name: service.name })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .where(inArray(session.id, sessionIds));
  const items = callList(
    entries,
    sessions.map((x) => toSessionSlots(x.s)),
    config,
    ctx.now,
  );
  const guardians = [...new Set(entries.map((e) => e.guardianId).filter((x): x is string => x !== null))];
  const phones = new Map(
    guardians.length === 0
      ? []
      : (
          await database
            .select({ id: patient.id, phone: patient.phone })
            .from(patient)
            .where(inArray(patient.id, guardians))
        ).map((p) => [p.id, p.phone]),
  );
  const attempts = await ctx.db
    .select({ target: audit.targetId, at: audit.at })
    .from(audit)
    .where(
      and(
        eq(audit.targetKind, "entry"),
        inArray(
          audit.targetId,
          entries.map((e) => e.id),
        ),
        sql`${audit.data}->>'answer' = 'no_contact'`,
      ),
    );
  return items.map((i) => {
    const e = entries.find((x) => x.id === i.entryId) as Entry;
    const s = sessions.find((x) => x.s.id === i.sessionId);
    const last = attempts
      .filter((t) => t.target === e.id && t.at.getTime() >= (e.allocatedAt ?? 0))
      .reduce<Date | null>((m, t) => (m && m > t.at ? m : t.at), null);
    return {
      entryId: e.id,
      name: e.person.name,
      phone: e.guardianId ? (phones.get(e.guardianId) ?? null) : null,
      service: s?.name ?? "",
      session: { id: i.sessionId, start: (s?.s.start ?? new Date(0)).toISOString() },
      allocatedAt: new Date(e.allocatedAt ?? i.deadline).toISOString(),
      deadline: new Date(i.deadline).toISOString(),
      highlighted: i.highlighted,
      lastAttempt: last ? last.toISOString() : null,
    };
  });
}

// T5.3: a lista de espera da unidade por serviço, com as sessões privadas planejadas que vêm.
export async function unitWaitlist(ctx: ActionContext, unitId: string): Promise<ServiceWaitlist[]> {
  await requireUnit(ctx.db, unitId);
  await requireScheduler(ctx, unitId);
  const services = await ctx.db
    .select()
    .from(service)
    .where(and(eq(service.unitId, unitId), eq(service.active, true)))
    .orderBy(asc(service.name));
  const exit: ServiceWaitlist[] = [];
  for (const srv of services) {
    const inWaitlist = (
      await ctx.db
        .select({ state: entry.state, classification: entry.classification, risk: entry.confirmedRisk })
        .from(entry)
        .where(and(eq(entry.serviceId, srv.id), notInArray(entry.state, [...FINAL_STATES])))
    ).filter((e) => e.state === "waiting" || e.state === "reassigned");
    const sessions = await ctx.db
      .select()
      .from(session)
      .where(
        and(
          eq(session.serviceId, srv.id),
          eq(session.visibility, "private"),
          eq(session.state, "planned"),
          gt(session.start, new Date(ctx.now)),
        ),
      )
      .orderBy(asc(session.start))
      .limit(20);
    const byState = new Map<string, { confirmed: number; pending: number }>();
    if (sessions.length > 0) {
      const rows = await ctx.db
        .select({ sessionId: entry.sessionId, state: entry.state, n: sql<number>`count(*)::int` })
        .from(entry)
        .where(
          inArray(
            entry.sessionId,
            sessions.map((s) => s.id),
          ),
        )
        .groupBy(entry.sessionId, entry.state);
      for (const l of rows) {
        const c = byState.get(l.sessionId ?? "") ?? { confirmed: 0, pending: 0 };
        if (l.state === "confirmed") c.confirmed += l.n;
        if (l.state === "allocated") c.pending += l.n;
        byState.set(l.sessionId ?? "", c);
      }
    }
    exit.push({
      service: { id: srv.id, name: srv.name, mode: srv.mode },
      waiting: inWaitlist.length,
      alerts: inWaitlist.filter((e) => e.risk === null && e.classification.level === "urgent").length,
      sessions: sessions.map((s) => ({
        id: s.id,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        slots: s.slots,
        taken: s.taken,
        ...(byState.get(s.id) ?? { confirmed: 0, pending: 0 }),
        professional: s.professional,
      })),
    });
  }
  return exit;
}
