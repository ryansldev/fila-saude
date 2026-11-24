import { applyTransition, ITEM_TRANSITIONS, type ItemState, type SessionState } from "./contracts.ts";
import type { UnitConfig } from "./kinds.ts";
import type { Origin } from "./list.ts";
import { type OrderKey, orderItems, precedes, type Risk } from "./order.ts";
import {
  canGivePriority,
  elderlyLevel,
  expired,
  fromAge,
  type GivePriorityContext,
  type Group,
  hasPriority,
  type LegalPriority,
  toVerify,
} from "./priority.ts";
import { type Event, failure, ok, type Result } from "./result.ts";

export type Stage = "triage" | "care";

/** O que bloqueia o check-in (RN-FILA-05): só a recepção resolve. */
export type PendingCheck = "account" | "attended_person" | "pre_registration" | "priority";

/**
 * Por que o item saiu da fila ("Saiu da fila"): decide a linha do contrato da entrada
 * (`entryOutcome`). pulos = 3º "Não compareceu"; falta = vez passada no encerramento;
 * nao_conferiu = identidade não confere (RN-FILA-05); cancelou = paciente cancelou ou desistiu;
 * removido = agendador removeu o lançamento.
 */
export type ExitReason = "skips" | "no_show" | "not_verified" | "cancelled" | "removed";

export type QueueItem = {
  id: string;
  entryId: string;
  ticket: string;
  number: number;
  stage: Stage;
  state: ItemState;
  pendingChecks: PendingCheck[];
  confirmedUrgency: boolean;
  risk: Risk;
  priority: LegalPriority;
  skips: number;
  lockedBehind: string[];
  /** Remoto desde (entrada na fila, "Vou sair" ou 2º pulo); `null` enquanto presente na etapa. */
  leftAt: number | null;
  /**
   * Presente na etapa desde (check-in, recepção, balcão, passagem da triagem, 1º pulo); `null` em casa.
   * Opcional: dias gravados antes do campo não o têm (vale `null`). Só para a tela (tempo de espera).
   */
  presentSince?: number | null;
  attendedInStages: Stage[];
  /**
   * RN-PERF-05: o técnico fez o acolhimento na triagem e a pessoa espera o enfermeiro classificar.
   * Opcional: dias gravados antes do campo não o têm.
   */
  welcomed?: boolean;
  /** Preenchido quando o item vai a "Saiu da fila"; `null` nos outros estados. */
  exitReason: ExitReason | null;
};

export type Station = { id: string; stage: Stage; services: string[]; open: boolean; calledItemId: string | null };

/** `recalls`: horários de "Rechamar" (RN-CHAM-02), para a TV repetir o anúncio; `em` não muda. */
export type Call = {
  itemId: string;
  stage: Stage;
  stationId: string;
  at: number;
  recalls?: number[];
  /** RN-ETA-05: chamada que terminou em "não compareceu" não é atendimento concluído. */
  noShow?: boolean;
  /** Hora em que a pessoa entrou na sala ("Compareceu"); a tolerância deixa de valer. */
  showedUpAt?: number;
};

export type SessionDay = {
  sessionId: string;
  /** Serviço da sessão: a estação só chama se o atende. */
  serviceId: string;
  state: SessionState;
  items: QueueItem[];
  calls: Call[];
  /** "Saia de casa" já enviados (RN-ETA-03): um por item e etapa; o estado carrega, o domínio não memoriza. */
  leaveHomeNotices: { itemId: string; stage: Stage }[];
  /**
   * "Venha agora" dados (RN-ETA-06): um por item e etapa, com a hora; vale enquanto o item não
   * voltou a remoto depois dele. Ausente nos dias gravados antes da AD-057.
   */
  comeNow?: { itemId: string; stage: Stage; at: number }[];
  /** Tempo médio inicial por etapa (RN-ETA-05), quando difere do padrão da unidade (ex.: triagem mais curta). */
  initialTimeMin?: Partial<Record<Stage, number>>;
  stations: Station[];
  config: UnitConfig;
  /** Períodos de contingência registrados (RN-CONT-02), com o motivo. */
  contingencies: { start: number; end: number; reason?: string }[];
  nextNumber: number;
  /** Prefixo de senha do serviço (RN-FILA-04), ex.: "C" → "C-001". */
  ticketPrefix: string;
  /** Serviço com triagem: quem entra começa na etapa de triagem (RN-TRI-01). */
  requiresTriage: boolean;
  /**
   * Preenchido ao encerrar (RN-SES-02): hora, itens que levaram falta no encerramento (os que um
   * período de contingência registrado no mesmo dia pode apagar, RN-CONT-03) e a origem que o
   * remanejado recebe (RN-REM-03).
   */
  closing?: { at: number; noShows: string[]; origin: Origin };
};

export const DEFAULT_CONFIG: UnitConfig = {
  timeZone: "America/Sao_Paulo",
  windowK: 1,
  toleranceMin: 5,
  leaveHomeMin: 30,
  arrivalDeadlineMin: 15,
  qrSeconds: 30,
  tvHighlightSeconds: 10,
  confirmationDeadlineHours: 24,
  initialAverageTimeMin: 15,
  municipalityOrder: "risk",
  noShowAlert: { noShows: 2, days: 90 },
  stillNeeds: { intervalDays: 30, deadlineDays: 7 },
  priorityDeadlines: {},
};

const key = (i: QueueItem): OrderKey => ({
  confirmedUrgency: i.confirmedUrgency,
  risk: i.risk,
  priority: i.priority,
  number: i.number,
});

/**
 * `items` (da etapa `stage`) em ordem(RN-ORD) com as vagas dos idosos (RV7). O 80+ já chamado na etapa
 * continua com a vaga de idoso que ocupou: senão, chamado ele, o idoso de 60-79 que ele passou voltaria
 * à frente dos outros grupos, e a ordem mudaria depois de cada chamada. Entram assim os 80+ com chamada
 * na etapa que não estão em `waiting` (quem ainda espera na etapa) e os de `gone` (já postos à frente).
 * Uso interno do pacote (estimativa e chamada).
 */
export function stageOrder(
  day: SessionDay,
  stage: Stage,
  items: QueueItem[],
  waiting: QueueItem[] = items,
  gone: QueueItem[] = [],
): QueueItem[] {
  const ids = new Set(items.map((i) => i.id));
  const waitingIds = new Set(waiting.map((i) => i.id));
  const goneIds = new Set(gone.map((i) => i.id));
  const called = new Set(day.calls.filter((c) => c.stage === stage).map((c) => c.itemId));
  const held = day.items.filter(
    (i) =>
      !ids.has(i.id) &&
      elderlyLevel(i.priority) === 2 &&
      (goneIds.has(i.id) || (called.has(i.id) && !waitingIds.has(i.id))),
  );
  return orderItems([...items, ...held], key, day.config.municipalityOrder).filter((i) => ids.has(i.id));
}

/**
 * Ordem de chamada real: ordem(RN-ORD) do conjunto, e ninguém passa à frente de quem o trava
 * enquanto o travador está no conjunto (janela protegida). A cada passo vai o primeiro da ordem entre
 * os livres: as vagas dos idosos (RV7) só se repartem entre quem já pode ser chamado, então o 80+
 * travado atrás de um idoso de 60-79 não tira dele a vaga e não o empurra para trás de outro grupo.
 * Sem candidato livre (não deveria ocorrer), segue a ordem sem travas em vez de travar a fila
 * (Review Focus 3).
 */
function callOrder(day: SessionDay, set: QueueItem[]): QueueItem[] {
  const stage = set[0]?.stage;
  if (stage === undefined) return [];
  const inSet = new Set(set.map((i) => i.id));
  const placed: QueueItem[] = [];
  const done = new Set<string>();
  const free = (i: QueueItem) => i.confirmedUrgency || i.lockedBehind.every((t) => !inSet.has(t) || done.has(t));
  while (placed.length < set.length) {
    const rest = set.filter((i) => !done.has(i.id));
    const first = (items: QueueItem[]) => stageOrder(day, stage, items, set, placed)[0];
    const next = first(rest.filter(free)) ?? first(rest);
    if (!next) break;
    placed.push(next);
    done.add(next.id);
  }
  return placed;
}

/** Presentes da etapa que a estação atende, dos serviços dela, em ordem de chamada com a janela protegida. */
export function eligible(day: SessionDay, stationId: string, operator: { classifies?: boolean } = {}): QueueItem[] {
  const station = day.stations.find((e) => e.id === stationId);
  if (!station?.services.includes(day.serviceId)) return [];
  const present = day.items.filter((i) => i.state === "present" && i.stage === station.stage);
  // RN-PERF-05: acolhido pelo técnico espera quem classifica (vem antes para ele); o técnico não o chama de novo.
  const classifies = operator.classifies ?? true;
  const welcomed = present.filter((i) => i.welcomed);
  const others = present.filter((i) => !i.welcomed);
  return classifies ? [...callOrder(day, welcomed), ...callOrder(day, others)] : callOrder(day, others);
}

/** A hora `em` cai num período de contingência registrado (AD-033). */
export const inContingency = (day: SessionDay, at: number): boolean =>
  day.contingencies.some((c) => at >= c.start && at <= c.end);

/**
 * Fim do prazo de chegada de X (RN-ETA-06, AD-057): hora do "venha agora" da etapa atual mais o
 * prazo da unidade. `null` enquanto X não recebeu "venha agora" desde que ficou remoto.
 */
export function arrivalDeadlineEnd(day: SessionDay, x: QueueItem): number | null {
  const notice = day.comeNow?.find((a) => a.itemId === x.id && a.stage === x.stage);
  if (!notice || (x.leftAt !== null && notice.at < x.leftAt)) return null;
  // Dias gravados antes da AD-057 não têm o prazo na config: vale o padrão.
  return notice.at + (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * 60_000;
}

/**
 * Chamadas que fazem a vez de X passar (AD-010): nesta etapa, de alguém que vem depois de X em
 * ordem. Só contam as feitas enquanto X estava remoto, ou seja, desde `leftAt` ("remoto desde"):
 * a entrada na fila (`byQueue`), "Vou sair" ou o 2º pulo. Sem `saiuEm` (item que passou da
 * triagem ao atendimento estando na unidade), contam todas as da etapa. Remoto só perde a vez por
 * chamadas feitas depois do fim do prazo de chegada (AD-057). Não filtra contingência: quem usa
 * decide (AD-033).
 */
export function callsThatSkipTurn(day: SessionDay, x: QueueItem): Call[] {
  const deadlineEnd = x.state === "remote" ? arrivalDeadlineEnd(day, x) : undefined;
  return day.calls.filter((c) => {
    if (c.stage !== x.stage || c.itemId === x.id) return false;
    if (x.leftAt !== null && c.at < x.leftAt) return false;
    if (deadlineEnd !== undefined && (deadlineEnd === null || c.at < deadlineEnd)) return false;
    const called = day.items.find((i) => i.id === c.itemId);
    // Só entre os dois (`precedes`): a fila de quando a chamada foi feita não existe mais (RV7).
    return called !== undefined && precedes(key(x), key(called), day.config.municipalityOrder);
  });
}

/**
 * Atraso (AD-010, AD-033): a vez de X passou por uma chamada fora de contingência.
 * Quem fica elegível estando na unidade (1º pulo, triagem → atendimento) não passa por aqui.
 */
export function turnPassed(day: SessionDay, x: QueueItem): boolean {
  return callsThatSkipTurn(day, x).some((c) => !inContingency(day, c.at));
}

/**
 * Uso interno do pacote (não sai pelo index, m1): põe em presente sem consultar o contrato; quem
 * chama já validou a transição. X fica elegível: trava X atrás dos K primeiros da ordem de chamada real (janela protegida) e,
 * com `aplicarAtraso`, aplica antes a regra de atraso. O atraso só vale para quem chega de fora
 * (check-in, presença pela recepção); no 1º pulo e na passagem da triagem ao atendimento a pessoa
 * estava na unidade, então não se aplica (RN-CHAM-03, RN-TRI-04). Urgência confirmada escapa dos dois.
 */
export function stayEligible(
  day: SessionDay,
  itemId: string,
  now: number,
  options: { applyDelay: boolean },
): { state: SessionDay; events: Event[] } {
  const x = day.items.find((i) => i.id === itemId);
  if (!x) return { state: day, events: [] };
  const lostTurn = options.applyDelay && !x.confirmedUrgency && turnPassed(day, x);
  const lockedBehind = x.confirmedUrgency
    ? []
    : callOrder(
        day,
        day.items.filter((i) => i.id !== x.id && i.state === "present" && i.stage === x.stage),
      )
        .slice(0, day.config.windowK)
        .map((i) => i.id);
  const number = lostTurn ? day.nextNumber : x.number;
  const fresh: QueueItem = { ...x, state: "present", number, lockedBehind, leftAt: null, presentSince: now };
  return {
    state: {
      ...day,
      items: day.items.map((i) => (i.id === x.id ? fresh : i)),
      nextNumber: lostTurn ? day.nextNumber + 1 : day.nextNumber,
    },
    events: [
      {
        kind: "present",
        itemId: x.id,
        entryId: x.entryId,
        sessionId: day.sessionId,
        data: { number, lostTurn, at: now },
      },
    ],
  };
}

/**
 * Pendências que bloqueiam o check-in (RN-FILA-05). Prioridade declarada e não conferida,
 * ou conferida e vencida, conta como "prioridade" mesmo que não esteja na lista. Idoso não conta
 * (vem da data de nascimento, coberta pela conferência de identidade; DECISÃO F1).
 */
function effectivePendingChecks(day: SessionDay, item: QueueItem, now: number): PendingCheck[] {
  const p = item.priority;
  const pendingPriority = toVerify(p).length > 0 && (!p.verified || expired(p, now, day.config.priorityDeadlines));
  return pendingPriority && !item.pendingChecks.includes("priority")
    ? [...item.pendingChecks, "priority"]
    : item.pendingChecks;
}

type Located = { ok: true; item: QueueItem } | { ok: false; error: "session_closed" | "forbidden_transition" };

/** Sessão aberta, item existe e o contrato permite o evento a partir do estado dele. */
function locate(day: SessionDay, itemId: string, event: string, to: ItemState): Located {
  if (day.state !== "open") return { ok: false, error: "session_closed" };
  const item = day.items.find((i) => i.id === itemId);
  if (!item || applyTransition(ITEM_TRANSITIONS, item.state, event) !== to) {
    return { ok: false, error: "forbidden_transition" };
  }
  return { ok: true, item };
}

function markAttendance(day: SessionDay, itemId: string, now: number): Result<SessionDay> {
  const found = locate(day, itemId, "QR válido ou recepção marca", "present");
  if (!found.ok) return failure(found.error);
  // Contrato: "QR válido" com pendência fica no mesmo estado; o check-in é recusado.
  if (effectivePendingChecks(day, found.item, now).length > 0) return failure("pending_check");
  const { state, events } = stayEligible(day, itemId, now, { applyDelay: true });
  return ok(state, events);
}

/** RN-PRES-01: QR válido (a validade do token é da Task de QR). Com pendência, recusa (RN-FILA-05). */
export function checkIn(day: SessionDay, cmd: { itemId: string }, now: number): Result<SessionDay> {
  return markAttendance(day, cmd.itemId, now);
}

/** RN-PRES-03: a recepção marca presença, como no check-in; com pendência, use `verifyAndMark`. */
export function markAttendanceWithoutApp(day: SessionDay, cmd: { itemId: string }, now: number): Result<SessionDay> {
  return markAttendance(day, cmd.itemId, now);
}

const EVENT_VERIFICATION = {
  matches: "Recepção confere e marca presença (inclui pessoa sem app)",
  priority_does_not_match: "Recepção confere a identidade, mas não a prioridade, e marca presença",
  does_not_match: 'Recepção recusa ("não conferiu"), com motivo',
} as const;

/**
 * RN-FILA-05: a recepção confere e, na mesma ação, marca a presença (o atraso conta a partir daqui).
 * A conferência da prioridade vale nas próximas idas: guarde-a com `verificationInEntry` (AD-024).
 * "priority_does_not_match" retira os grupos declarados; idoso (da data de nascimento) fica.
 * "does_not_match" tira da fila sem falta e sem remanejamento; a entrada vai a Cancelada com
 * `entryOutcome` (ou no encerramento).
 */
export function verifyAndMark(
  day: SessionDay,
  cmd: { itemId: string; result: "matches" | "does_not_match" | "priority_does_not_match"; reason?: string },
  now: number,
): Result<SessionDay> {
  const to = cmd.result === "does_not_match" ? "left_queue" : "present";
  const found = locate(day, cmd.itemId, EVENT_VERIFICATION[cmd.result], to);
  if (!found.ok) return failure(found.error);
  const item = found.item;
  const base = { itemId: item.id, entryId: item.entryId };

  if (cmd.result === "does_not_match") {
    const left: QueueItem = { ...item, state: "left_queue", lockedBehind: [], exitReason: "not_verified" };
    return ok({ ...day, items: day.items.map((i) => (i.id === item.id ? left : i)) }, [
      { kind: "not_verified", ...base, ...(cmd.reason === undefined ? {} : { reason: cmd.reason }) },
    ]);
  }

  const hadPendingCheck = effectivePendingChecks(day, item, now).length > 0;
  const priority: LegalPriority =
    cmd.result === "priority_does_not_match"
      ? { groups: item.priority.groups.filter(fromAge), verified: false, verifiedAt: null }
      : hasPriority(item.priority)
        ? { ...item.priority, verified: true, verifiedAt: now }
        : item.priority;
  const verified: QueueItem = { ...item, pendingChecks: [], priority };
  const events: Event[] = [];
  if (cmd.result === "priority_does_not_match") events.push({ kind: "priority_removed", ...base });
  if (hadPendingCheck) events.push({ kind: "pending_check_resolved", ...base });
  const checked = stayEligible(
    { ...day, items: day.items.map((i) => (i.id === item.id ? verified : i)) },
    item.id,
    now,
    { applyDelay: true },
  );
  return ok(checked.state, [...events, ...checked.events]);
}

/**
 * RN-RISCO-04: a recepção dá prioridade legal só ao incluir no balcão ou na 1ª presença de paciente
 * sem app (que vale como inclusão no balcão); a quem já está na lista ou na fila, não
 * (`canGivePriority`). Conferida na hora (documento visto); idoso não se dá (data de nascimento,
 * AD-027). Item remoto ou presente, sessão aberta. Guarde na entrada com `verificationInEntry`.
 */
export function givePriority(
  day: SessionDay,
  cmd: { itemId: string; groups: Group[]; context: GivePriorityContext },
  now: number,
): Result<SessionDay> {
  if (!canGivePriority(cmd.context)) return failure("no_permission");
  if (day.state !== "open") return failure("session_closed");
  const item = day.items.find((i) => i.id === cmd.itemId);
  if (!item || (item.state !== "remote" && item.state !== "present")) return failure("forbidden_transition");
  const data = cmd.groups.filter((g) => !fromAge(g));
  const groups = [...new Set([...item.priority.groups, ...data])];
  const fresh: QueueItem = {
    ...item,
    priority: { groups, verified: true, verifiedAt: now },
    pendingChecks: item.pendingChecks.filter((p) => p !== "priority"),
  };
  return ok({ ...day, items: day.items.map((i) => (i.id === item.id ? fresh : i)) }, [
    {
      kind: "priority_given",
      itemId: item.id,
      entryId: item.entryId,
      data: { groups: [...new Set(data)], context: cmd.context },
    },
  ]);
}

/** RN-PRES-02: volta a remoto mantendo o número; quem sai não trava mais ninguém. */
export function leaving(day: SessionDay, cmd: { itemId: string }, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const item = day.items.find((i) => i.id === cmd.itemId);
  if (!item || applyTransition(ITEM_TRANSITIONS, item.state, 'Paciente toca "Vou sair"') !== "remote") {
    return failure("forbidden_transition");
  }
  const items = day.items.map((i) =>
    i.id === item.id
      ? { ...i, state: "remote" as const, leftAt: now, lockedBehind: [], presentSince: null }
      : { ...i, lockedBehind: i.lockedBehind.filter((t) => t !== item.id) },
  );
  return ok({ ...day, items }, [{ kind: "left", itemId: item.id, entryId: item.entryId, sessionId: day.sessionId }]);
}
