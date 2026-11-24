import {
  arrivalDeadlineEnd,
  DEFAULT_CONFIG,
  eligible,
  lateness,
  type QueueItem,
  type SessionDay,
  type Stage,
  stageOrder,
  turnPassed,
} from "./queue.ts";
import type { Event } from "./result.ts";

const MIN = 60_000;

export type Estimate =
  | { kind: "position"; position: number; minutes: number; query?: { minutes: number } }
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
  for (const times of byStation.values()) {
    const sorted = [...times].sort((a, b) => a.at - b.at);
    sorted.forEach((start, k) => {
      const next = sorted[k + 1];
      // "Não compareceu" não é atendimento concluído (RN-ETA-05.2).
      if (next !== undefined && !start.skip) durations.push({ end: next.at, min: (next.at - start.at) / MIN });
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

const open = (day: SessionDay, stage: Stage) =>
  day.stations.filter((e) => e.open && e.stage === stage && e.services.includes(day.serviceId));

const inQueue = (i: QueueItem): boolean => i.state === "remote" || i.state === "present";

/**
 * Quantos de `set` vêm antes de `item` em ordem(todas), com as vagas dos idosos (RV7, PL2): a mesma regra
 * da chamada, então o 80+ em casa é avisado na hora certa. As vagas só mexem nos idosos: os outros grupos
 * e quem não tem prioridade ficam no mesmo lugar que a senha lhes dá.
 */
const aheadIn = (day: SessionDay, set: QueueItem[], waiting: QueueItem[], item: QueueItem): number =>
  stageOrder(day, item.stage, set.some((i) => i.id === item.id) ? set : [...set, item], waiting).findIndex(
    (i) => i.id === item.id,
  );

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
  const n = stations.length;
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
            inStage,
            item,
          );
  if (ahead < 0) return { kind: "awaiting_start" };
  const comeNow = item.state === "remote" && ahead === 0;
  const minutes = Math.ceil((ahead * averageTime(day, item.stage, day.serviceId, now)) / n);
  const primary: Estimate = comeNow ? { kind: "come_now" } : { kind: "position", position: ahead + 1, minutes };
  if (item.stage !== "triage") return primary;

  // RN-ETA-01c/AD-009: na triagem, a previsão da consulta vai à parte (inclusive com "venha agora").
  const nA = open(day, "care").length;
  if (nA === 0) return primary;
  // Quem já está na fila do atendimento é atendido antes de X chegar lá (RN-TRI-04: fila nova);
  // da triagem, contam os que vêm antes de X.
  const beforeQuery =
    day.items.filter((i) => i.id !== item.id && inQueue(i) && i.stage === "care").length +
    aheadIn(day, inStage, inStage, item);
  const triageWeight = (ahead * averageTime(day, "triage", day.serviceId, now)) / n;
  const query = Math.ceil(triageWeight + (beforeQuery * averageTime(day, "care", day.serviceId, now)) / nA);
  return { ...primary, query: { minutes: query } };
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
    const minutes = e.kind === "come_now" ? 0 : e.kind === "position" ? e.minutes : null;
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
