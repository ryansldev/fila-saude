import {
  type Action,
  callNext,
  close,
  closeStage,
  closeStation,
  closingConsequence,
  type Entry,
  type Event,
  eligible,
  entryOutcome,
  fillFromReserve,
  finish,
  firstName,
  noShow,
  OPERATE_CAVEAT_STAGE,
  type QueueItem,
  type Result,
  type RiskLevel,
  recall,
  reopenStation,
  type SessionDay,
  sessionOrigin,
  showedUp,
  showedUpAt,
  TARGET_TIME_MIN,
  toleranceExceeded,
  triageClosed,
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
import { inSession, readDay, type SessionContext } from "./day";
import { entryNames } from "./panel";
import { stationSignal } from "./signal";

const IN_QUEUE = 3;
/** Sem cor confirmada (ainda não triado), o tempo-alvo da pílula "o mais antigo". */
const UNCOLORED_TARGET_MIN = 30;

const targetTime = (i: QueueItem): number =>
  i.confirmedUrgency || i.attendedInStages.includes("triage") ? TARGET_TIME_MIN[i.risk] : UNCOLORED_TARGET_MIN;

export const OPERATE: Action = "operate_calls";

type StationRow = Awaited<ReturnType<typeof requireStation>>;

// PD-46: as ressalvas de `operate_calls` (texto da matriz) são a etapa da estação.
const caveatsOf = (e: StationRow): Caveats =>
  Object.fromEntries(Object.entries(OPERATE_CAVEAT_STAGE).map(([caveat, stage]) => [caveat, () => e.stage === stage]));

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
  const form = e && { suggestedRisk: e.c.level, rule: e.c.rule, support: e.c.support };
  return { priority, triage: form };
}

async function build(
  db: TenantDatabase,
  e: StationRow,
  s: { id: string; service: string; state: string } | null,
  day: SessionDay | null,
  now: number,
  classifies: boolean,
  notice: StationOperation["notice"] = null,
): Promise<StationOperation> {
  const est = day?.stations.find((x) => x.id === e.id);
  const item = est?.calledItemId ? day?.items.find((i) => i.id === est.calledItemId) : undefined;
  const queue = day && est ? eligible(day, e.id, { classifies }) : [];
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
    station: {
      id: e.id,
      name: e.name,
      stage: e.stage,
      closedAt: est?.closedAt === undefined ? null : new Date(est.closedAt).toISOString(),
      closing: day?.state === "open" ? closingConsequence(day, e.id) : null,
    },
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
    // RN-PERF-05: quem opera classifica o risco (enfermeiro); o técnico só acolhe.
    classifies: e.stage === "triage" && classifies,
    timeZone: day?.config.timeZone ?? null,
  };
}

/** RN-PERF-05: só o enfermeiro confirma o nível de risco (Cofen 661/2021). */
const canClassify = (ctx: ActionContext, unitId: string) => allowed(ctx.actor.profiles, "confirm_risk_level", unitId);

export async function stationOperation(ctx: ActionContext, stationId: string): Promise<StationOperation> {
  const e = await requireStation(ctx.db, stationId);
  if (!(await allowed(ctx.actor.profiles, OPERATE, e.unitId, caveatsOf(e)))) throw new ApiError(403, "no_permission");
  await stationSignal(ctx.db, stationId, ctx.now);
  const s = await openSession(ctx.db, stationId);
  return build(ctx.db, e, s, s ? await readDay(ctx.db, s.id) : null, ctx.now, await canClassify(ctx, e.unitId));
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
  }
  return entries.map((en) => (level.has(en.id) ? { ...en, confirmedRisk: level.get(en.id) ?? null } : en));
}

/**
 * RN-EST-07: fechar a última estação (já confirmado) encerra a sessão ou fecha a triagem na mesma transação;
 * reabrir a triagem fechada põe a reserva nas vagas livres. Nulo quando o comando não mexe na sessão.
 */
function closingAfter(c: SessionContext, day: SessionDay, stationId: string, command: "close" | "reopen", now: number) {
  const before = c.day as SessionDay;
  const origin = sessionOrigin(c.session, c.service);
  if (command === "reopen") {
    if (!triageClosed(before) || triageClosed(day)) return null;
    const r = fillFromReserve(c.session, day, c.entries, { service: c.service, acceptedPhotos: [] }, now);
    if (!r.ok) throw new ApiError(409, r.error);
    return {
      consequence: null,
      day: r.state.day ?? day,
      entries: r.state.entries,
      session: r.state.session,
      events: r.events,
    };
  }
  // Já fechada antes (toque duplo), o comando não mudou nada: a sessão também não muda.
  const consequence = closingConsequence(before, stationId);
  if (consequence === "closes_session") {
    const r = close(day, c.entries, now, { withoutSignalWithoutContingency: false, origin });
    if (!r.ok) throw new ApiError(409, r.error);
    return { consequence, day: r.state.day, entries: r.state.entries, session: null, events: r.events };
  }
  if (consequence === "closes_stage") {
    const r = closeStage(day, c.entries, c.session, "triage", now, origin);
    if (!r.ok) throw new ApiError(409, r.error);
    return { consequence, day: r.state.day, entries: r.state.entries, session: r.state.session, events: r.events };
  }
  return null;
}

const COMMANDS: Record<
  StationCommand,
  (
    d: SessionDay,
    cmd: { stationId: string; confirmedRisk?: RiskLevel; refer?: boolean; classifies?: boolean },
    now: number,
  ) => Result<SessionDay>
> = {
  call: callNext,
  recall,
  finish,
  "no-show": noShow,
  "showed-up": showedUp,
  "undo-showed-up": undoShowedUp,
  close: closeStation,
  reopen: reopenStation,
};

// T3.7 / RN-CHAM: o comando trava a sessão (INV-04) e passa pelo guard e pela auditoria.
export async function commandInStation(
  ctx: ActionContext,
  stationId: string,
  command: StationCommand,
  body: { confirmedRisk?: RiskLevel | undefined; refer?: boolean | undefined; confirmed?: boolean | undefined } = {},
): Promise<StationOperation> {
  const { confirmedRisk, refer, confirmed } = body;
  const e = await requireStation(ctx.db, stationId);
  const classifies = await canClassify(ctx, e.unitId);
  if (!classifies && (confirmedRisk !== undefined || refer))
    throw new ApiError(403, "no_permission", undefined, "A classificação de risco é do enfermeiro.");
  // A auditoria diz sobre quem o comando caiu (`before`) e quem ficou chamado depois (`after`).
  let before: string | null = null;
  // Fechar a última estação (RN-EST-07): o que aconteceu com a sessão fica na auditoria.
  let consequence: ReturnType<typeof closingConsequence> = null;
  return runAction(
    ctx,
    {
      action: OPERATE,
      target: { kind: "station", id: stationId },
      unitId: e.unitId,
      caveats: caveatsOf(e),
      data: (r) => ({ command, before, after: r.called?.ticket ?? null, ...(consequence ? { consequence } : {}) }),
    },
    async (tx) => {
      await stationSignal(tx, stationId, ctx.now);
      const s = await openSession(tx, stationId);
      if (!s) throw new ApiError(409, "session_closed", undefined, "Nenhuma sessão aberta nesta estação.");
      return inSession(tx, s.id, async (c) => {
        if (!c.day) throw new ApiError(409, "session_closed");
        // H3: na triagem, quem sai do chamado sai classificado (só o enfermeiro confirma, AD-056).
        const closes = command === "call" || command === "finish";
        const called = c.day.stations.find((x) => x.id === stationId)?.calledItemId;
        before = c.day.items.find((i) => i.id === called)?.ticket ?? null;
        // O técnico fecha sem cor: a pessoa volta para o enfermeiro classificar (RN-PERF-05).
        if (classifies && e.stage === "triage" && closes && called && confirmedRisk === undefined) {
          throw new ApiError(422, "classify_risk", undefined, "Escolha a cor da classificação de risco.");
        }
        const extra =
          closes && called ? { ...(confirmedRisk ? { confirmedRisk } : {}), ...(refer ? { refer } : {}) } : {};
        const close = command === "close" && confirmed ? { confirmed } : {};
        const r = COMMANDS[command](c.day, { stationId, ...extra, ...close, classifies }, ctx.now);
        if (!r.ok) {
          if (r.error === "none_eligible" && command === "call") {
            return { result: await build(tx, e, s, c.day, ctx.now, classifies, "nobody_waiting") };
          }
          if (r.error === "no_show_up") {
            throw new ApiError(409, r.error, undefined, "Marque Compareceu antes de classificar.");
          }
          throw new ApiError(409, r.error);
        }
        const after =
          command === "close" || command === "reopen" ? closingAfter(c, r.state, stationId, command, ctx.now) : null;
        if (after) consequence = after.consequence;
        const day = after?.day ?? r.state;
        const entries = after?.entries ?? closeEntries(day, withConfirmedRisk(c.entries, r.events));
        const events = [...r.events, ...(after?.events ?? [])];
        const nobody = command === "call" && !day.stations.find((x) => x.id === stationId)?.calledItemId;
        // Encerrou a sessão: a estação fica sem sessão aberta (como na próxima consulta), com o aviso, sem "Reabrir".
        const ended = after?.consequence === "closes_session";
        const result = ended
          ? await build(tx, e, null, null, ctx.now, classifies, "session_closed")
          : await build(tx, e, s, day, ctx.now, classifies, nobody ? "nobody_waiting" : null);
        return { day, entries, events, ...(after?.session ? { session: after.session } : {}), result };
      });
    },
  );
}
