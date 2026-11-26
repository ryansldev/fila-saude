import {
  type Action,
  advancePauses,
  averageTime,
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
  type PauseBack,
  pausedAt,
  pauseNow,
  pauseStation,
  type QueueItem,
  type Result,
  type RiskLevel,
  recall,
  reopenStation,
  resumeStation,
  type SessionDay,
  serveBeforePause,
  sessionOrigin,
  showedUp,
  showedUpAt,
  TARGET_TIME_MIN,
  toleranceExceeded,
  triageClosed,
  undoShowedUp,
  waitingBeforePause,
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
const MIN = 60_000;
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
  // O relógio da pausa até agora (a varredura grava o mesmo a cada giro).
  const current = day ? advancePauses(day, now) : null;
  const est = current?.stations.find((x) => x.id === e.id);
  const item = est?.calledItemId ? day?.items.find((i) => i.id === est.calledItemId) : undefined;
  const queue = day && est ? eligible(day, e.id, { classifies }) : [];
  const remote = day ? day.items.filter((i) => i.state === "remote" && i.stage === e.stage) : [];
  const onTheWay = [...remote].sort((a, b) => a.number - b.number).slice(0, IN_QUEUE);
  const upcoming = queue.slice(0, IN_QUEUE);
  // Opção C: quem chegou no prazo e espera a estação responder "atender antes de pausar?".
  const order =
    current && est?.pause?.state === "asking"
      ? inCallOrder(current, e.id, classifies, now)
      : { items: [], canServe: false };
  const asked = order.items;
  const names = await entryNames(db, [
    ...(item ? [item.entryId] : []),
    ...upcoming.map((i) => i.entryId),
    ...onTheWay.map((i) => i.entryId),
    ...asked.map((i) => i.entryId),
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
      pause:
        est?.pause && current
          ? pauseOf(est.pause, {
              waiting: asked.map((i) => ({ ticket: i.ticket, name: names.get(i.entryId) ?? "" })),
              canServe: order.canServe,
              avgMin: averageTime(current, e.stage, current.serviceId, now),
              now,
            })
          : null,
      pauseStartsAt: day ? pauseStartsAt(day, e.id, now) : null,
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

const iso = (t: number) => new Date(t).toISOString();

/**
 * Opção C: quem espera a resposta, na ordem em que "atender antes" chama (os que esta estação pode chamar
 * primeiro), para o botão "Atender <nome>" nomear quem vai mesmo ser chamado.
 */
function inCallOrder(
  day: SessionDay,
  stationId: string,
  classifies: boolean,
  now: number,
): { items: QueueItem[]; canServe: boolean } {
  const waiting = waitingBeforePause(day, stationId, now);
  const ids = new Set(waiting.map((i) => i.id));
  const callable = eligible(day, stationId, { classifies }).filter((i) => ids.has(i.id));
  return { items: [...callable, ...waiting.filter((i) => !callable.includes(i))], canServe: callable.length > 0 };
}

type StationPause = NonNullable<SessionDay["stations"][number]["pause"]>;

type PausePanel = NonNullable<StationOperation["station"]["pause"]>;
type Asked = { waiting: { ticket: string; name: string }[]; canServe: boolean; avgMin: number; now: number };
const isoOrNull = (t: number | null) => (t === null ? null : iso(t));

/**
 * A pausa na tela da estação. Perguntando (opção C): quem espera e a volta se atender o primeiro antes (a pausa
 * começa ao fim do atendimento, pelo tempo médio, com a mesma duração).
 */
function pauseOf(p: StationPause, asked?: Asked): PausePanel {
  switch (p.state) {
    case "scheduled":
      return { state: p.state, from: iso(p.from), until: isoOrNull(p.until) };
    case "paused":
      return { state: p.state, from: iso(p.since), until: isoOrNull(p.until) };
    case "serving":
      return { state: p.state, lengthMin: p.length === null ? null : Math.round(p.length / MIN) };
    case "asking": {
      const servedAt = asked ? asked.now + asked.avgMin * MIN : null;
      const untilIfServed = p.until === null || servedAt === null ? null : servedAt + (p.until - p.since);
      return {
        state: p.state,
        from: iso(p.since),
        until: isoOrNull(p.until),
        waiting: asked?.waiting ?? [],
        untilIfServed: isoOrNull(untilIfServed),
        canServe: asked?.canServe ?? false,
      };
    }
  }
}

/** RN-EST-06: quando a pausa começaria se tocasse "Pausar" agora (o domínio decide, sem gravar); nulo se não pausa. */
function pauseStartsAt(day: SessionDay, stationId: string, now: number): string | null {
  const r = pauseStation(day, { stationId, back: null }, now);
  const p = r.ok ? r.state.stations.find((x) => x.id === stationId)?.pause : undefined;
  if (!p) return null;
  const view = pauseOf(p);
  return "from" in view ? view.from : null;
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
    cmd: { stationId: string; confirmedRisk?: RiskLevel; refer?: boolean; classifies?: boolean; back?: PauseBack },
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
  pause: (d, cmd, now) => pauseStation(d, { stationId: cmd.stationId, back: cmd.back ?? null }, now),
  resume: resumeStation,
  "serve-before-pause": serveBeforePause,
  "pause-now": pauseNow,
};

// T3.7 / RN-CHAM: o comando trava a sessão (INV-04) e passa pelo guard e pela auditoria.
export async function commandInStation(
  ctx: ActionContext,
  stationId: string,
  command: StationCommand,
  body: {
    confirmedRisk?: RiskLevel | undefined;
    refer?: boolean | undefined;
    confirmed?: boolean | undefined;
    back?: { at: string } | { inMin: number } | null | undefined;
  } = {},
): Promise<StationOperation> {
  const { confirmedRisk, refer, confirmed } = body;
  const back: PauseBack | undefined =
    body.back === undefined || body.back === null
      ? body.back
      : "at" in body.back
        ? { at: Date.parse(body.back.at) }
        : body.back;
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
        const pause = command === "pause" && back !== undefined ? { back } : {};
        const r = COMMANDS[command](c.day, { stationId, ...extra, ...close, ...pause, classifies }, ctx.now);
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
        // Sem ninguém chamado depois de "chamar": ninguém aguardando, a não ser que a pausa tenha começado (só finalizou).
        const here = day.stations.find((x) => x.id === stationId);
        const nobody = command === "call" && here !== undefined && !here.calledItemId && !pausedAt(day, here, ctx.now);
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
