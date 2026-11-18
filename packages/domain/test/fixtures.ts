import { showedUp } from "../src/call.ts";
import type { Answers } from "../src/kinds.ts";
import type { Entry, SessionSlots } from "../src/list.ts";
import { DEFAULT_CONFIG, type QueueItem, type SessionDay } from "../src/queue.ts";

/** Respostas "sem nada": motivo de rotina, sem alarmes, condições ou grupos. */
export function answers(partial: Partial<Answers> = {}): Answers {
  return {
    alarms: [],
    reason: "exam",
    severity: null,
    conditions: [],
    groups: [],
    ...partial,
  };
}

/** Respostas de "problema novo" com a gravidade dada. */
export function newProblem(severity: NonNullable<Answers["severity"]>, partial: Partial<Answers> = {}): Answers {
  return answers({ reason: "new", severity, ...partial });
}

/** Congela em profundidade: qualquer mutação numa ação pura vira TypeError (módulos ES são estritos). */
export function freeze<T>(x: T): T {
  if (x !== null && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) freeze(v);
  }
  return x;
}

/** Item remoto, sem pendência, rotina, sem prioridade. */
export function queueItem(id: string, number: number, partial: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    entryId: `ent-${id}`,
    ticket: `C${String(number).padStart(3, "0")}`,
    number,
    stage: "care",
    state: "remote",
    pendingChecks: [],
    confirmedUrgency: false,
    risk: "routine",
    priority: { groups: [], verified: false, verifiedAt: null },
    skips: 0,
    lockedBehind: [],
    leftAt: null,
    attendedInStages: [],
    exitReason: null,
    ...partial,
  };
}

/**
 * Sessão aberta do serviço "cli" com uma estação "e1" de atendimento e os itens remotos,
 * numerados na ordem dada (RN-FILA-01). Volta congelado.
 */
export function dayWith(ids: string[], partial: Partial<SessionDay> = {}): SessionDay {
  return freeze({
    sessionId: "s1",
    serviceId: "cli",
    state: "open",
    items: ids.map((id, i) => queueItem(id, i + 1)),
    calls: [],
    leaveHomeNotices: [],
    stations: [{ id: "e1", stage: "care", services: ["cli"], open: true, calledItemId: null }],
    config: DEFAULT_CONFIG,
    contingencies: [],
    nextNumber: ids.length + 1,
    ticketPrefix: "C",
    requiresTriage: false,
    ...partial,
  });
}

/** Cópia congelada com o item alterado (montagem de cenário, não regra de domínio). */
export function withItem(day: SessionDay, id: string, partial: Partial<QueueItem>): SessionDay {
  return freeze({ ...day, items: day.items.map((i) => (i.id === id ? { ...i, ...partial } : i)) });
}

/**
 * Simula a chamada da Task 6 (chamarProximo) só no que a fila do dia observa:
 * o item vira "chamado", a chamada é registrada e as travas sobre ele acabam.
 */
export function call(day: SessionDay, id: string, at: number, stationId = "e1"): SessionDay {
  const item = day.items.find((i) => i.id === id);
  if (!item) throw new Error(`item ${id} não existe`);
  return freeze({
    ...day,
    items: day.items.map((i) =>
      i.id === id
        ? { ...i, state: "called" as const, lockedBehind: [] }
        : { ...i, lockedBehind: i.lockedBehind.filter((t) => t !== id) },
    ),
    calls: [...day.calls, { itemId: id, stage: item.stage, stationId, at }],
  });
}

/** Entrada "aguardando" no serviço "cli", rotina, sem prioridade, adulto sem CPF. Volta congelada. */
export function entry(id: string, partial: Partial<Entry> = {}): Entry {
  return freeze({
    id,
    serviceId: "cli",
    guardianId: "resp-1",
    person: { name: `Pessoa ${id}`, birthDate: "1990-01-01", cpf: null },
    state: "waiting",
    originalEntryDate: Date.UTC(2026, 9, 1, 12, 0),
    classification: { level: "routine", rule: "Sem sinais de risco", support: false },
    confirmedRisk: null,
    priority: { groups: [], verified: false, verifiedAt: null },
    reassigned: null,
    refusals: 0,
    sessionId: null,
    allocatedAt: null,
    askedAt: null,
    answeredAt: null,
    archivedAt: null,
    refusedSessions: [],
    ...partial,
  });
}

/** Sessão privada "s1" do serviço "cli", 3 vagas livres, início 13/11/2026 07:00 em Brasília. Volta congelada. */
export function sessionSlots(partial: Partial<SessionSlots> = {}): SessionSlots {
  return freeze({
    id: "s1",
    serviceId: "cli",
    visibility: "private",
    slots: 3,
    start: Date.UTC(2026, 10, 13, 10, 0),
    taken: 0,
    ...partial,
  });
}

/**
 * AD-057: o remoto só perde a vez por chamadas depois do prazo de chegada do "venha agora".
 * Registra um "venha agora" em `em` (padrão: bem antes de tudo, com o prazo já vencido); com
 * `deadlineMin`, troca o prazo da unidade (para testar saídas no meio do dia).
 */
export function alreadyNotified(day: SessionDay, itemId: string, at = 0, deadlineMin?: number): SessionDay {
  const stage = day.items.find((i) => i.id === itemId)?.stage ?? "care";
  return freeze({
    ...day,
    config: deadlineMin === undefined ? day.config : { ...day.config, arrivalDeadlineMin: deadlineMin },
    comeNow: [...(day.comeNow ?? []).filter((a) => a.itemId !== itemId), { itemId, stage, at }],
  });
}

/**
 * Triagem: a pessoa chamada entrou na sala ("Compareceu"), como a estação faz antes de classificar.
 * Fora da triagem (ou sem ninguém chamado) devolve o dia igual.
 */
export function inRoom(day: SessionDay, stationId: string): SessionDay {
  if (day.stations.find((e) => e.id === stationId)?.stage !== "triage") return day;
  const at = day.calls[day.calls.length - 1]?.at ?? 0;
  const r = showedUp(day, { stationId }, at);
  return r.ok ? r.state : day;
}
