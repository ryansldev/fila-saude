import { type Pause, pausedBetween, stagePause, stopsForGood } from "./pause-time.ts";
import {
  arrivalDeadlineEnd,
  DEFAULT_CONFIG,
  eligible,
  lateness,
  type QueueItem,
  type SessionDay,
  type Stage,
  type Station,
  stageOrder,
  turnPassed,
} from "./queue.ts";
import type { Event } from "./result.ts";

const MIN = 60_000;

export type Estimate =
  /** `pause`: a pausa da etapa que atrasa a vez (atual ou à frente); o tempo já a soma, menos sem hora de volta. */
  | { kind: "position"; position: number; minutes: number; query?: { minutes: number }; pause?: Pause }
  | { kind: "come_now"; query?: { minutes: number } }
  | { kind: "awaiting_start" }
  | { kind: "manual_mode" }
  /** Chamado agora numa estação: o app mostra a chamada, não uma posição. */
  | { kind: "called" }
  /** Atendido, fora da fila, remanejado, ou sessão encerrada/cancelada: sem estimativa. */
  | { kind: "out_of_queue" };

type Options = { manualMode: boolean };

const median = (sorted: number[]): number => {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[m] as number) : ((sorted[m - 1] as number) + (sorted[m] as number)) / 2;
};

const initial = (day: SessionDay, stage: Stage): number =>
  day.initialTimeMin?.[stage] ?? day.config.initialAverageTimeMin;

/**
 * RN-ETA-05: duração = da chamada até a próxima chamada na mesma estação (a última de cada estação
 * não entra). Últimos 10 da etapa, sem os fora da curva (< 1/3 ou > 3× a mediana); média dos que
 * sobram, ou o tempo inicial se forem menos de 3. Só vale para o serviço da sessão.
 */
export function averageTime(day: SessionDay, stage: Stage, serviceId: string, now: number): number {
  if (serviceId !== day.serviceId) return initial(day, stage);
  const byStation = new Map<string, { at: number; skip: boolean }[]>();
  for (const c of day.calls) {
    if (c.stage !== stage || c.at > now) continue;
    byStation.set(c.stationId, [...(byStation.get(c.stationId) ?? []), { at: c.at, skip: Boolean(c.noShow) }]);
  }
  const durations: { end: number; min: number }[] = [];
  for (const [stationId, times] of byStation) {
    const station = day.stations.find((e) => e.id === stationId);
    const sorted = [...times].sort((a, b) => a.at - b.at);
    sorted.forEach((start, k) => {
      const next = sorted[k + 1];
      if (next === undefined || start.skip) return;
      // "Não compareceu" não é atendimento concluído (RN-ETA-05.2); a pausa no meio não é atendimento.
      const paused = pausedBetween(day, station, start.at, next.at);
      durations.push({ end: next.at, min: (next.at - start.at - paused) / MIN });
    });
  }
  const last = durations
    .sort((a, b) => a.end - b.end)
    .slice(-10)
    .map((d) => d.min);
  if (last.length === 0) return initial(day, stage);
  const doc = median([...last].sort((a, b) => a - b));
  const valid = last.filter((m) => m >= doc / 3 && m <= doc * 3);
  if (valid.length < 3) return initial(day, stage);
  return valid.reduce((s, m) => s + m, 0) / valid.length;
}

/**
 * Capacidade (PA3): a estação que para sem hora de volta antes da vez (`by`) não conta; a pausa com volta é
 * passageira e conta. Todas paradas: conta as abertas, para o tempo depois da volta (a pausa da etapa decide).
 */
const capacity = (stations: Station[], by: number) =>
  stations.filter((e) => !stopsForGood(e, by)).length || stations.length;

const open = (day: SessionDay, stage: Stage) =>
  day.stations.filter((e) => e.open && e.stage === stage && e.services.includes(day.serviceId));

const inQueue = (i: QueueItem): boolean => i.state === "remote" || i.state === "present";

/**
 * Quantos de `set` vêm antes de `item` em ordem(todas), com as vagas dos idosos (RV7, AD-075): a mesma regra
 * da chamada, então o 80+ em casa é avisado na hora certa. As vagas só mexem nos idosos: os outros grupos
 * e quem não tem prioridade ficam no mesmo lugar que a senha lhes dá.
 */
const aheadIn = (day: SessionDay, set: QueueItem[], item: QueueItem): number =>
  stageOrder(day, item.stage, set.some((i) => i.id === item.id) ? set : [...set, item]).findIndex(
    (i) => i.id === item.id,
  );

/**
 * A pausa da etapa no tempo (plano-pausa-e-fechar): em pausa agora, soma o resto dela; o próximo em casa que
 * chegaria (prazo de chegada) dentro da pausa não recebe "venha agora" e espera a volta; quem seria chamado
 * depois do início de uma pausa à frente soma a duração. Sem hora de volta, o tempo não a soma.
 */
function withPause(
  day: SessionDay,
  item: QueueItem,
  ahead: number,
  queue: number,
  now: number,
): { minutes: number; pause?: Pause; blocked: boolean } {
  const p = stagePause(day, item.stage, now);
  if (!p) return { minutes: queue, blocked: false };
  // O primeiro, já com "venha agora" e a caminho: a pausa avisada começa depois do prazo dele.
  const onTheWay = item.state === "remote" && ahead === 0 && arrivalDeadlineEnd(day, item) !== null;
  if (onTheWay && lateness(day, item, now) !== "late") return { minutes: queue, blocked: false };
  const deadline = (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * MIN;
  const left = (t: number | null) => (t === null ? 0 : (t - now) / MIN);
  if (p.from <= now) return { minutes: left(p.until) + queue, pause: p, blocked: true };
  if (item.state === "remote" && ahead === 0 && p.from < now + deadline) {
    return { minutes: p.until === null ? queue : left(p.until), pause: p, blocked: true };
  }
  // Em casa, a vez vale com o prazo de chegada: o "venha agora" não sai se o prazo cai na pausa.
  const remote = item.state === "remote";
  if (now + queue * MIN + (remote ? deadline : 0) < p.from) return { minutes: queue, blocked: false };
  if (p.until === null) return { minutes: queue, pause: p, blocked: false };
  const withBreak = queue + (p.until - p.from) / MIN;
  return { minutes: remote ? Math.max(withBreak, left(p.until)) : withBreak, pause: p, blocked: false };
}

/**
 * RN-ETA-01/01b/01c/02/04 (AD-002, AD-003, AD-009) e RN-SES-05 (AD-043).
 * Presente: lugar na ordem de chamada real (janela protegida); remoto: quantos vêm antes em
 * ordem(todas), presentes e remotos. Quem está na triagem vê o tempo até a triagem e, à parte,
 * a previsão da consulta. Só quem espera (remoto ou presente) na sessão aberta tem posição:
 * sessão planejada aguarda o início; encerrada ou cancelada, ou item em estado final, está fora
 * da fila; chamado vê a chamada. Item inexistente é erro de programação: lança.
 */
export function estimate(day: SessionDay, itemId: string, now: number, options: Options): Estimate {
  const item = day.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`item ${itemId} não existe`);
  if (day.state === "planned") return { kind: "awaiting_start" };
  if (day.state !== "open" || (!inQueue(item) && item.state !== "called")) return { kind: "out_of_queue" };
  if (item.state === "called") return { kind: "called" };
  if (options.manualMode) return { kind: "manual_mode" };

  const stations = open(day, item.stage);
  const first = stations[0];
  if (!first) return { kind: "awaiting_start" };

  const inStage = day.items.filter((i) => inQueue(i) && i.stage === item.stage);
  // AD-076: remoto que perdeu o prazo de chegada perdeu a vez: vai para o fim ao chegar e não está "à
  // frente" de ninguém. Urgência confirmada não perde a vez, mas também não segura a fila parada. Com o
  // prazo estendido por uma contingência, ainda está a caminho.
  const pastDeadline = (i: QueueItem) => lateness(day, i, now) === "late";
  const passed = (i: QueueItem) => !i.confirmedUrgency && turnPassed(day, i, now);
  const account = (i: QueueItem) => !pastDeadline(i);
  const ahead =
    item.state === "present"
      ? eligible(day, first.id).findIndex((i) => i.id === item.id)
      : passed(item)
        ? inStage.filter((i) => i.id !== item.id && account(i)).length
        : aheadIn(
            day,
            inStage.filter((i) => i.id === item.id || account(i)),
            item,
          );
  if (ahead < 0) return { kind: "awaiting_start" };
  const avg = averageTime(day, item.stage, day.serviceId, now);
  const n = capacity(stations, now + ((ahead * avg) / stations.length) * MIN);
  const queue = (ahead * avg) / n;
  const { minutes, pause, blocked } = withPause(day, item, ahead, queue, now);
  const comeNow = item.state === "remote" && ahead === 0 && !blocked;
  const primary: Estimate = comeNow
    ? { kind: "come_now" }
    : { kind: "position", position: ahead + 1, minutes: Math.ceil(minutes), ...(pause ? { pause } : {}) };
  if (item.stage !== "triage") return primary;

  // RN-ETA-01c/AD-009: na triagem, a previsão da consulta vai à parte (inclusive com "venha agora").
  const careStations = open(day, "care");
  if (careStations.length === 0) return primary;
  // Sem hora de volta na triagem, não há como prever a consulta.
  if (pause?.until === null) return primary;
  // Quem já está na fila do atendimento é atendido antes de X chegar lá (RN-TRI-04: fila nova);
  // da triagem, contam os que vêm antes de X, como na posição (quem perdeu a vez vai para o fim, AD-076).
  const fromTriage = passed(item)
    ? ahead
    : aheadIn(
        day,
        inStage.filter((i) => i.id === item.id || account(i)),
        item,
      );
  const beforeQuery = day.items.filter((i) => i.id !== item.id && inQueue(i) && i.stage === "care").length + fromTriage;
  // A triagem com a pausa dela (o tempo da posição); o atendimento soma a pausa dele se cair na espera.
  const triageWeight = comeNow ? 0 : minutes;
  const careStart = now + triageWeight * MIN;
  const careAvg = averageTime(day, "care", day.serviceId, now);
  const nA = capacity(careStations, careStart + ((beforeQuery * careAvg) / careStations.length) * MIN);
  const careQueue = (beforeQuery * careAvg) / nA;
  const carePause = stagePause(day, "care", careStart);
  // Pausa sem hora de volta do atendimento dentro da espera: não há como prever a consulta.
  if (carePause?.until === null && carePause.from <= careStart + careQueue * MIN) return primary;
  const careExtra =
    carePause && carePause.until !== null && carePause.from <= careStart + careQueue * MIN
      ? Math.max(0, carePause.until - Math.max(carePause.from, careStart)) / MIN
      : 0;
  return { ...primary, query: { minutes: Math.ceil(triageWeight + careQueue + careExtra) } };
}

/**
 * RN-ETA-03 (AD-009, AD-043): "saia de casa" para o remoto cujo tempo até a etapa atual caiu abaixo
 * do limite, uma vez por item e etapa. O que já foi enviado vive em `day.leaveHomeNotices`, então a
 * função devolve o novo dia junto com os eventos; em modo manual nada é enviado nem registrado.
 */
export function leaveHomeNotices(day: SessionDay, now: number, options: Options): { day: SessionDay; events: Event[] } {
  if (options.manualMode || day.state !== "open") return { day, events: [] };
  const alreadySent = (i: QueueItem) => day.leaveHomeNotices.some((a) => a.itemId === i.id && a.stage === i.stage);
  const fresh: QueueItem[] = [];
  const events: Event[] = [];
  for (const i of day.items) {
    if (i.state !== "remote" || alreadySent(i)) continue;
    const e = estimate(day, i.id, now, options);
    // Pausa sem hora de volta: não há como saber a hora de sair.
    const unknown = e.kind === "position" && e.pause?.until === null;
    const minutes = e.kind === "come_now" ? 0 : e.kind === "position" && !unknown ? e.minutes : null;
    if (minutes === null || minutes >= day.config.leaveHomeMin) continue;
    fresh.push(i);
    events.push({
      kind: "leave_home",
      itemId: i.id,
      entryId: i.entryId,
      sessionId: day.sessionId,
      data: { stage: i.stage, minutes, at: now },
    });
  }
  if (fresh.length === 0) return { day, events };
  return {
    day: {
      ...day,
      leaveHomeNotices: [...day.leaveHomeNotices, ...fresh.map((i) => ({ itemId: i.id, stage: i.stage }))],
    },
    events,
  };
}

/**
 * RN-ETA-06 (AD-057): "venha agora" para o remoto sem ninguém à frente, uma vez por item e etapa
 * enquanto ele não volta a remoto ("Vou sair" recomeça). A hora fica em
 * `day.comeNow`: o prazo de chegada conta dela. Em modo manual nada é enviado nem registrado.
 */
export function comeNowNotices(day: SessionDay, now: number, options: Options): { day: SessionDay; events: Event[] } {
  if (options.manualMode || day.state !== "open") return { day, events: [] };
  const fresh: QueueItem[] = [];
  const events: Event[] = [];
  for (const i of day.items) {
    if (i.state !== "remote" || arrivalDeadlineEnd(day, i) !== null) continue;
    if (estimate(day, i.id, now, options).kind !== "come_now") continue;
    fresh.push(i);
    events.push({
      kind: "come_now",
      itemId: i.id,
      entryId: i.entryId,
      sessionId: day.sessionId,
      data: {
        stage: i.stage,
        at: now,
        deadlineMin: day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin,
        // Urgência confirmada não perde a vez pelo prazo (AD-076): o aviso não diz que perde.
        losesTurn: !i.confirmedUrgency,
      },
    });
  }
  if (fresh.length === 0) return { day, events };
  const ids = new Set(fresh.map((i) => i.id));
  const kept = (day.comeNow ?? []).filter((a) => !ids.has(a.itemId));
  return {
    day: { ...day, comeNow: [...kept, ...fresh.map((i) => ({ itemId: i.id, stage: i.stage, at: now }))] },
    events,
  };
}

/**
 * AD-076: "perdeu a vez" para o remoto cujo prazo de chegada do "venha agora" acabou (fora de
 * contingência; urgência confirmada não perde a vez), uma vez por "venha agora". A hora do aviso fica no
 * registro do "venha agora" em `day.comeNow`. Com o sinal da unidade parado o atraso espera (PV5, `lateness`).
 * Em modo manual nada é enviado nem registrado.
 */
export function turnLostNotices(day: SessionDay, now: number, options: Options): { day: SessionDay; events: Event[] } {
  if (options.manualMode || day.state !== "open") return { day, events: [] };
  const events: Event[] = [];
  const comeNow = (day.comeNow ?? []).map((a) => {
    const i = day.items.find((x) => x.id === a.itemId);
    if (a.turnLostAt !== undefined || !i || i.stage !== a.stage || i.confirmedUrgency) return a;
    if (!turnPassed(day, i, now)) return a;
    events.push({
      kind: "turn_lost",
      itemId: i.id,
      entryId: i.entryId,
      sessionId: day.sessionId,
      data: { stage: a.stage, at: now, comeNowAt: a.at },
    });
    return { ...a, turnLostAt: now };
  });
  return events.length === 0 ? { day, events } : { day: { ...day, comeNow }, events };
}
