import { callItem } from "./call.ts";
import { averageTime } from "./estimate.ts";
import { inManualMode, pendingOutage } from "./outage.ts";
import {
  advance,
  advancePauses,
  inBreak,
  leavePause,
  move,
  pauseNotices,
  waitingIn,
  withHeld,
  withStop,
} from "./pause-time.ts";
import {
  DEFAULT_CONFIG,
  eligible,
  extendedDeadlineEnd,
  lateness,
  type QueueItem,
  type SessionDay,
  type Stage,
  type Station,
} from "./queue.ts";
import { type Event, failure, ok, type Result } from "./result.ts";

export { advancePauses, callingAt, heldNow, type Pause, pausedAt, pauseState, stagePause } from "./pause-time.ts";

type Cmd = { stationId: string };
/** A volta: num horário, em minutos contados do início da pausa, ou sem hora (nulo). */
export type PauseBack = { at: number } | { inMin: number } | null;

const MIN = 60_000;

const withStation = (day: SessionDay, e: Station): SessionDay => ({
  ...day,
  stations: day.stations.map((x) => (x.id === e.id ? e : x)),
});

/** Quem da etapa está a caminho: recebeu "venha agora" e ainda está no prazo (a urgência que passou dele não, PA5). */
function onTheWay(
  day: SessionDay,
  stage: Stage,
  now: number,
): { who: { id: string; by: number }[]; until: number | null } {
  const who = day.items
    .filter((i) => i.state === "remote" && i.stage === stage && lateness(day, i, now) !== "late")
    .map((i) => ({ id: i.id, by: extendedDeadlineEnd(day, i, now) }))
    .filter((w): w is { id: string; by: number } => w.by !== null);
  return { who, until: who.length > 0 ? Math.max(...who.map((w) => w.by)) : null };
}

/**
 * "Pausar" (RN-EST-06): sem pausa → marcada. A pausa nunca pega ninguém a caminho: com alguém da etapa no prazo
 * do "venha agora" (ou no prazo estendido por uma queda), começa depois do prazo da unidade, ou do estendido se
 * for maior; senão, agora (e já entra em pausa). Com pausa marcada ou em curso, recusa (volte ou desmarque
 * antes). A volta é opcional; em minutos, conta do início; antes do início, recusa. Não pausa com paciente
 * chamado, estação fechada ou a unidade sem sinal (PA4).
 */
export function pauseStation(day: SessionDay, cmd: Cmd & { back: PauseBack }, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const found = day.stations.find((x) => x.id === cmd.stationId);
  if (!found?.open) return failure("forbidden_transition");
  const e = advance(day, found, now);
  if (e.pause) return failure("station_already_paused");
  if (e.calledItemId !== null) return failure("station_has_call");
  // Com queda aberta ou por confirmar, o prazo de quem vem pode crescer: não dá para saber quando pausar.
  if (inManualMode(day) || pendingOutage(day, now)) return failure("pause_during_outage");
  const deadline = (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * MIN;
  const coming = onTheWay(day, e.stage, now);
  const from = coming.until === null ? now : Math.max(now + deadline, coming.until);
  const back = cmd.back;
  const until = back === null ? null : "at" in back ? back.at : from + back.inMin * MIN;
  if (until !== null && !(Number.isFinite(until) && until > from)) return failure("pause_back_before_start");
  // Opção C: quem está a caminho fica guardado; se chegar e não for chamado antes da pausa, a estação pergunta.
  const waitFor = coming.until === null ? {} : { waitFor: coming.who };
  const scheduled = advance(day, { ...e, pause: { state: "scheduled", from, until, ...waitFor } }, now);
  return ok(withStation(day, scheduled), [{ kind: "station_paused", stationId: e.id, data: { from, until } }]);
}

/**
 * "Voltar agora" (em pausa) ou "Desmarcar a pausa" (marcada): sem pausa (já sem ela, nada muda). Em pausa, ela vira parada no
 * histórico e o silêncio conta da volta. No intervalo da sessão, tira a pausa própria, mas a estação só chama
 * no fim dele (que já conta como volta).
 */
export function resumeStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const found = day.stations.find((x) => x.id === cmd.stationId);
  if (!found?.open) return failure("forbidden_transition");
  const e = advance(day, found, now);
  // Já sem pausa (toque duplo, ou a hora de volta passou antes da varredura): nada muda além do relógio.
  if (!e.pause) return ok(e === found ? day : withStation(day, e));
  const paused = e.pause.state === "paused";
  const back = leavePause(e, paused ? "Voltar agora" : "Desmarcar a pausa", now);
  // Em pausa ou perguntando, a estação estava parada: o silêncio conta da volta.
  const stopped = paused || e.pause.state === "asking";
  const since = stopped && !inBreak(day, now) ? { callingSince: now } : {};
  return ok(withStation(day, { ...back, ...since }), [{ kind: "station_resumed", stationId: e.id }]);
}

/** Reabrir a estação fechada (fechou por engano): volta a chamar nesta sessão; o tempo fechada vira parada. */
export function reopenStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e || e.open) return failure("forbidden_transition");
  const { closedAt, ...rest } = e;
  const closed = closedAt === undefined ? undefined : { start: closedAt, end: now };
  return ok(withStation(day, { ...rest, ...withStop(e, closed), open: true, callingSince: now }), [
    { kind: "station_reopened", stationId: e.id },
  ]);
}

/** Opção C: quanto a estação tem para responder "atender antes de pausar?" antes da justificativa sair (PA7). */
export const PAUSE_ANSWER_MS = 3 * 60_000;

/** Opção C: quem chegou no prazo e espera a estação responder (perguntando) ou atender antes de pausar. */
export function waitingBeforePause(day: SessionDay, stationId: string, now: number): QueueItem[] {
  const found = day.stations.find((x) => x.id === stationId);
  if (!found) return [];
  const e = advance(day, found, now);
  const p = e.pause;
  return p?.state === "asking" || p?.state === "serving" ? waitingIn(day, e, p.waitFor) : [];
}

type AskingEvent = "Pausar agora" | "Sem resposta" | "Ninguém dos que esperam pode ser chamado aqui";

/** Perguntando → em pausa, desde quando passou a perguntar, com a justificativa para quem esperava. */
function pauseAsking(day: SessionDay, e: Station, event: AskingEvent, now: number): Result<SessionDay> {
  const p = e.pause;
  if (p?.state !== "asking") return failure("forbidden_transition");
  move(e, event);
  const notices = pauseNotices(day, e, p.until, now);
  const pause = { state: "paused" as const, since: p.since, until: p.until };
  return ok(withHeld(withStation(day, { ...e, pause }), notices, p.since), [
    ...notices,
    { kind: "station_paused", stationId: e.id, data: { from: p.since, until: p.until } },
  ]);
}

/** A pergunta já foi respondida (ou acabou): em pausa, atendendo antes ou sem pausa. */
const answered = (e: Station) => e.pause?.state !== "asking" && e.pause?.state !== "scheduled";

function asking(day: SessionDay, stationId: string, now: number): Result<Station> {
  if (day.state !== "open") return failure("session_closed");
  const found = day.stations.find((x) => x.id === stationId);
  if (!found?.open) return failure("forbidden_transition");
  return ok(advance(day, found, now));
}

/**
 * Opção C, "atender antes de pausar": chama o primeiro de quem chegou no prazo (na ordem de sempre, que esta
 * estação pode chamar) e a pausa espera o fim do atendimento, com a mesma duração. Sem nenhum deles que esta
 * estação chame (ex.: o técnico e o acolhido), entra em pausa com a justificativa.
 */
export function serveBeforePause(
  day: SessionDay,
  cmd: Cmd & { classifies?: boolean },
  now: number,
): Result<SessionDay> {
  const found = asking(day, cmd.stationId, now);
  if (!found.ok) return found;
  const e = found.state;
  // Toque duplo, tela velha ou a varredura pausou antes: a pergunta já acabou, nada muda além do relógio.
  if (answered(e)) return ok(withStation(day, e));
  if (inBreak(day, now)) return failure("session_break");
  const p = e.pause;
  if (p?.state !== "asking") return failure("forbidden_transition");
  const ids = new Set(waitingIn(day, e, p.waitFor).map((i) => i.id));
  const next = eligible(day, e.id, { classifies: cmd.classifies ?? true }).find((i) => ids.has(i.id));
  if (!next) return pauseAsking(day, e, "Ninguém dos que esperam pode ser chamado aqui", now);
  move(e, "Atender antes de pausar");
  const length = p.until === null ? null : p.until - p.since;
  // A pausa começa ao fim deste atendimento: previsto pelo tempo médio da etapa.
  const from = now + averageTime(day, e.stage, day.serviceId, now) * MIN;
  // O tempo perguntando a estação não chamou: vira parada, e o silêncio conta de agora.
  const stopped = { ...e, ...withStop(e, { start: p.since, end: now }), callingSince: now };
  const serving = withStation(day, { ...stopped, pause: { state: "serving", from, length, waitFor: p.waitFor } });
  return callItem(serving, e.id, next, now);
}

/** Opção C, "pausar agora": entra em pausa e quem chegou no prazo recebe a justificativa. */
export function pauseNow(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  const found = asking(day, cmd.stationId, now);
  if (!found.ok) return found;
  // Toque duplo, tela velha ou a varredura pausou antes: a pergunta já acabou, nada muda além do relógio.
  if (answered(found.state)) return ok(withStation(day, found.state));
  return pauseAsking(day, found.state, "Pausar agora", now);
}

/**
 * Varredura (opção C): o relógio da pausa e, perguntando há `PAUSE_ANSWER_MS` (desde que a pergunta foi vista)
 * sem resposta, entra em pausa e manda a justificativa, uma vez. Não com a unidade sem sinal.
 */
export function pauseAnswerTimeouts(day: SessionDay, now: number): { day: SessionDay; events: Event[] } {
  let current = advancePauses(day, now);
  const events: Event[] = [];
  // Com a unidade sem sinal, a estação pode não estar conseguindo responder: ninguém pausa por ela, e os 3 min
  // recomeçam quando o sinal voltar.
  if (inManualMode(current) || pendingOutage(current, now)) {
    const stations = current.stations.map((e) =>
      e.pause?.state === "asking" ? { ...e, pause: { ...e.pause, askedAt: now } } : e,
    );
    return { day: stations.some((e, k) => e !== current.stations[k]) ? { ...current, stations } : current, events };
  }
  for (const e of current.stations) {
    const p = e.pause;
    if (p?.state !== "asking" || now - p.askedAt < PAUSE_ANSWER_MS) continue;
    const r = pauseAsking(current, e, "Sem resposta", now);
    if (!r.ok) continue;
    current = r.state;
    events.push(...r.events);
  }
  return { day: current, events };
}
