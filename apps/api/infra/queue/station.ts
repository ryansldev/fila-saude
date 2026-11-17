import {
  type Action,
  callNext,
  type Entry,
  type Event,
  eligible,
  entryOutcome,
  finish,
  firstName,
  noShow,
  type QueueItem,
  type Result,
  type RiskLevel,
  recall,
  type SessionDay,
  showedUp,
  showedUpAt,
  TARGET_TIME_MIN,
  toleranceExceeded,
  undoShowedUp,
} from "@fila-saude/domain";
import type { StationCommand, StationOperation } from "@fila-saude/schemas/queue";
import { and, desc, eq } from "drizzle-orm";
import { requireStation } from "infra/config/stations";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { allowed, type Caveats } from "infra/panel/guard";
import { inSession, readDay } from "./day";
import { entryNames } from "./panel";

const IN_QUEUE = 3;
/** Sem cor confirmada (ainda não triado), o tempo-alvo da pílula "o mais antigo". */
const UNCOLORED_TARGET_MIN = 30;

const targetTime = (i: QueueItem): number =>
  i.confirmedUrgency || i.attendedInStages.includes("triage") ? TARGET_TIME_MIN[i.risk] : UNCOLORED_TARGET_MIN;

export const OPERATE: Action = "operate_calls";

type StationRow = Awaited<ReturnType<typeof requireStation>>;

// PD-46: as ressalvas de `operate_calls` (texto da matriz) são a etapa da estação.
const caveatsOf = (e: StationRow): Caveats => ({
  "acolhimento na triagem": () => e.stage === "triage",
  atendimento: () => e.stage === "care",
});

async function openSession(db: TenantDatabase, stationId: string) {
  const [row] = await db
    .select({ id: session.id, service: service.name, state: session.state })
    .from(sessionStation)
    .innerJoin(session, eq(sessionStation.sessionId, session.id))
    .innerJoin(service, eq(session.serviceId, service.id))
    .where(and(eq(sessionStation.stationId, stationId), eq(session.state, "open")))
    .orderBy(desc(session.start))
    .limit(1);
  return row ?? null;
}

// A prioridade de quem está chamado e, na triagem, a ficha para classificar (RN-RISCO-01/06): uma leitura só.
async function calledData(db: TenantDatabase, entryId: string, triage: boolean) {
  const [e] = await db.select({ c: entry.classification, p: entry.priority }).from(entry).where(eq(entry.id, entryId));
  const priority = e?.p.groups ?? [];
  if (!triage) return { priority };
  const form = e && { suggestedRisk: e.c.level, rule: e.c.rule, support: e.c.support, priority };
  return { priority, triage: form };
}

async function build(
  db: TenantDatabase,
  e: StationRow,
  s: { id: string; service: string; state: string } | null,
  day: SessionDay | null,
  now: number,
  notice: StationOperation["notice"] = null,
): Promise<StationOperation> {
  const est = day?.stations.find((x) => x.id === e.id);
  const item = est?.calledItemId ? day?.items.find((i) => i.id === est.calledItemId) : undefined;
  const queue = day && est ? eligible(day, e.id) : [];
  const remote = day ? day.items.filter((i) => i.state === "remote" && i.stage === e.stage) : [];
  const onTheWay = [...remote].sort((a, b) => a.number - b.number).slice(0, IN_QUEUE);
  const upcoming = queue.slice(0, IN_QUEUE);
  const names = await entryNames(db, [
    ...(item ? [item.entryId] : []),
    ...upcoming.map((i) => i.entryId),
    ...onTheWay.map((i) => i.entryId),
  ]);
  const short = (i: QueueItem) => firstName(names.get(i.entryId) ?? "");
  const since = (i: QueueItem) => new Date(i.presentSince ?? now).toISOString();
  const old = queue
    .filter((i) => i.presentSince != null)
    .reduce<QueueItem | null>((m, i) => (m === null || (i.presentSince ?? 0) < (m.presentSince ?? 0) ? i : m), null);
  const came = day && item ? showedUpAt(day, e.id) : null;
  const last = item && day?.calls.findLast((ch) => ch.itemId === item.id && ch.stage === item.stage);
  return {
    station: { id: e.id, name: e.name, stage: e.stage },
    session: s,
    called:
      item && day
        ? {
            itemId: item.id,
            ticket: item.ticket,
            name: names.get(item.entryId) ?? "",
            stage: item.stage,
            skips: item.skips,
            calledAt: new Date(last ? last.at : now).toISOString(),
            toleranceExceeded: toleranceExceeded(day, e.id, now),
            showedUpAt: came === null ? null : new Date(came).toISOString(),
            ...(await calledData(db, item.entryId, e.stage === "triage")),
          }
        : null,
    waiting: queue.length,
    remote: remote.length,
    upcoming: upcoming.map((i) => ({ ticket: i.ticket, name: short(i), presentSince: since(i) })),
    onTheWay: onTheWay.map((i) => ({ ticket: i.ticket, name: short(i) })),
    oldest: old ? { presentSince: since(old), targetTimeMin: targetTime(old) } : null,
    toleranceMin: day?.config.toleranceMin ?? 0,
    notice,
    now: new Date(now).toISOString(),
  };
}

export async function stationOperation(ctx: ActionContext, stationId: string): Promise<StationOperation> {
  const e = await requireStation(ctx.db, stationId);
  if (!(await allowed(ctx.actor.profiles, OPERATE, e.unitId, caveatsOf(e)))) throw new ApiError(403, "no_permission");
  const s = await openSession(ctx.db, stationId);
  return build(ctx.db, e, s, s ? await readDay(ctx.db, s.id) : null, ctx.now);
}

// Itens que ficaram finais nesta ação fecham a entrada (desfechoDaEntrada).
function closeEntries(day: SessionDay, entries: Entry[]): Entry[] {
  return entries.map((en) => {
    const item = day.items.find((i) => i.entryId === en.id);
    if (!item || en.state !== "in_queue") return en;
    const r = entryOutcome(en, item);
    return r.ok ? r.state : en;
  });
}

// INV-07: o risco que a triagem deu vai para a entrada (vermelho também, AD-059).
function withConfirmedRisk(entries: Entry[], events: Event[]): Entry[] {
  const level = new Map<string, RiskLevel>();
  for (const ev of events) {
    if (!ev.entryId) continue;
    if (ev.kind === "risk_confirmed") level.set(ev.entryId, ev.data?.level as RiskLevel);
    if (ev.kind === "referred_to_emergency") level.set(ev.entryId, "emergency");
  }
  return entries.map((en) => (level.has(en.id) ? { ...en, confirmedRisk: level.get(en.id) ?? null } : en));
}

const COMMANDS: Record<
  StationCommand,
  (
    d: SessionDay,
    cmd: { stationId: string; confirmedRisk?: RiskLevel; refer?: boolean },
    now: number,
  ) => Result<SessionDay>
> = {
  call: callNext,
  recall,
  finish,
  "no-show": noShow,
  "showed-up": showedUp,
  "undo-showed-up": undoShowedUp,
};

// T3.7 / RN-CHAM: o comando trava a sessão (INV-04) e passa pelo guard e pela auditoria.
export async function commandInStation(
  ctx: ActionContext,
  stationId: string,
  command: StationCommand,
  body: { confirmedRisk?: RiskLevel | undefined; refer?: boolean | undefined } = {},
): Promise<StationOperation> {
  const { confirmedRisk, refer } = body;
  const e = await requireStation(ctx.db, stationId);
  return runAction(
    ctx,
    {
      action: OPERATE,
      target: { kind: "station", id: stationId },
      unitId: e.unitId,
      caveats: caveatsOf(e),
      data: (r) => ({ command, ticket: r.called?.ticket ?? null }),
    },
    async (tx) => {
      const s = await openSession(tx, stationId);
      if (!s) throw new ApiError(409, "session_closed", undefined, "Nenhuma sessão aberta nesta estação.");
      return inSession(tx, s.id, async (c) => {
        if (!c.day) throw new ApiError(409, "session_closed");
        // H3: na triagem, quem sai do chamado sai classificado (só o enfermeiro confirma, AD-056).
        const closes = command === "call" || command === "finish";
        const called = c.day.stations.find((x) => x.id === stationId)?.calledItemId;
        if (e.stage === "triage" && closes && called && confirmedRisk === undefined) {
          throw new ApiError(422, "classify_risk", undefined, "Escolha a cor da classificação de risco.");
        }
        const extra =
          closes && called ? { ...(confirmedRisk ? { confirmedRisk } : {}), ...(refer ? { refer } : {}) } : {};
        const r = COMMANDS[command](c.day, { stationId, ...extra }, ctx.now);
        if (!r.ok) {
          if (r.error === "none_eligible" && command === "call") {
            return { result: await build(tx, e, s, c.day, ctx.now, "nobody_waiting") };
          }
          if (r.error === "no_show_up") {
            throw new ApiError(409, r.error, undefined, "Marque Compareceu antes de classificar.");
          }
          throw new ApiError(409, r.error);
        }
        const day = r.state;
        const nobody = command === "call" && !day.stations.find((x) => x.id === stationId)?.calledItemId;
        return {
          day,
          entries: closeEntries(day, withConfirmedRisk(c.entries, r.events)),
          events: r.events,
          result: await build(tx, e, s, day, ctx.now, nobody ? "nobody_waiting" : null),
        };
      });
    },
  );
}
