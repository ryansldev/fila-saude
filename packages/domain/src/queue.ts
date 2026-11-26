import { applyTransition, ITEM_TRANSITIONS, type ItemState, type SessionState } from "./contracts.ts";
import type { UnitConfig } from "./kinds.ts";
import type { Origin } from "./list.ts";
import { type OrderKey, orderItems, type Risk } from "./order.ts";
import { pendingOutage, stalledSince } from "./outage.ts";
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
  /** Remoto desde (entrada na fila ou "Vou sair"); `null` enquanto presente na etapa. */
  leftAt: number | null;
  /**
   * Presente na etapa desde (check-in, recepção, balcão, passagem da triagem, 1º e 2º pulo); `null` em casa.
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

/**
 * `open` falso: fechada nesta sessão (RN-EST-07). `pause`: a pausa avisada (RN-EST-06), desde `from`; `until`
 * nulo, sem hora de volta.
 */
export type Station = {
  id: string;
  stage: Stage;
  services: string[];
  open: boolean;
  calledItemId: string | null;
  /**
   * A pausa (`PAUSE_TRANSITIONS`); `until` nulo, sem hora de volta. Marcada: `waitFor`, quem estava a caminho e
   * até quando podia chegar (`by`). Perguntando (opção C): na hora da pausa, quem chegou no prazo espera; parada
   * desde `since`, e a pergunta vista desde `askedAt` (os 3 min contam dela). Atendendo antes:
   * `length`, a duração da pausa que começa ao fim do atendimento, previsto para `from` (pelo tempo médio).
   */
  pause?:
    | { state: "scheduled"; from: number; until: number | null; waitFor?: { id: string; by: number }[] }
    | { state: "asking"; since: number; askedAt: number; until: number | null; waitFor: string[] }
    | { state: "serving"; from: number; length: number | null; waitFor: string[] }
    | { state: "paused"; since: number; until: number | null };
  /** Voltou a chamar ("voltar agora" de uma pausa em curso, ou reaberta): o silêncio de antes não é queda. */
  callingSince?: number;
  /** Paradas já encerradas nesta sessão (pausas e tempo fechada): não contam como atendimento. */
  stops?: { start: number; end: number }[];
  /** Fechada desde (RN-EST-07); a reabertura vira uma parada em `stops`. */
  closedAt?: number;
  /**
   * Falso: quem opera agora não classifica (técnico, RN-PERF-05) e não chama quem já foi acolhido. Guardado a cada
   * ação da estação (`operateStation`); sem o campo, classifica.
   */
  classifies?: false;
};

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
  /**
   * A chave da ordem na hora da chamada (RV7): o 80+ chamado guarda a vaga de idoso em que estava, mesmo
   * que a triagem mude o risco ou o número dele depois. Chamadas gravadas antes disso não têm a chave.
   */
  orderKey?: OrderKey;
};

export type SessionDay = {
  sessionId: string;
  /**
   * Opção C: quem chegou no prazo e recebeu a justificativa, de qual estação e de qual parada dela (`since`, o
   * início da pausa ou a hora em que fechou); sai quando é chamado. Enquanto essa parada dura, vê a pausa como
   * "antes da sua vez" e não recebe outra justificativa.
   */
  heldByPause?: { id: string; stationId: string; since: number }[];
  /** Serviço da sessão: a estação só chama se o atende. */
  serviceId: string;
  state: SessionState;
  items: QueueItem[];
  calls: Call[];
  /** "Saia de casa" já enviados (RN-ETA-03): um por item e etapa; o estado carrega, o domínio não memoriza. */
  leaveHomeNotices: { itemId: string; stage: Stage }[];
  /**
   * "Venha agora" dados (RN-ETA-06): um por item e etapa, com a hora; vale enquanto o item não
   * voltou a remoto depois dele. Ausente nos dias gravados antes da AD-057. `turnLostAt`: hora do aviso
   * "perdeu a vez" (AD-076), quando o prazo desse "venha agora" acabou.
   */
  comeNow?: { itemId: string; stage: Stage; at: number; turnLostAt?: number }[];
  /** Tempo médio inicial por etapa (RN-ETA-05), quando difere do padrão da unidade (ex.: triagem mais curta). */
  initialTimeMin?: Partial<Record<Stage, number>>;
  stations: Station[];
  config: UnitConfig;
  /** Períodos de contingência registrados (RN-CONT-02), com o motivo. */
  contingencies: { start: number; end: number; reason?: string }[];
  /**
   * Quedas que o sistema percebeu sozinho (PV5 da AD-076, RN-SES-05): a unidade sem sinal ou o servidor
   * fora do ar (reiniciado). `end` nulo: a queda continua (modo manual). Ausente nos dias de antes.
   */
  outages?: { start: number; end: number | null }[];
  /** Hora em que a sessão abriu de verdade (pode ser depois do início marcado); ausente nos dias de antes. */
  openedAt?: number;
  /** Pausas planejadas de todas as estações: o vão entre as faixas de horário da sessão. */
  breaks?: { start: number; end: number }[];
  /** Hora do último giro da varredura nesta sessão: o servidor reiniciado depois dela esteve fora do ar. */
  lastSweepAt?: number;
  /** Último sinal de vida da unidade que a varredura viu nesta sessão; sem ele, a unidade não começou. */
  liveSignalAt?: number;
  /** Último sinal da TV visto nesta sessão: daí em diante só a TV conta (PV5). */
  tvLiveAt?: number;
  /** O último sinal da fonte que conta, no último giro; com ele parado, o atraso espera (`pendingOutage`). */
  unitSignalAt?: number | null;
  /** De onde veio `unitSignalAt` no último giro: a TV ou as estações (cada uma tem a sua folga). */
  signalSource?: "tv" | "stations";
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
  arrivalDeadlineMin: 30,
  qrSeconds: 30,
  tvHighlightSeconds: 10,
  confirmationDeadlineHours: 24,
  initialAverageTimeMin: 15,
  municipalityOrder: "risk",
  noShowAlert: { noShows: 2, days: 90 },
  stillNeeds: { intervalDays: 30, deadlineDays: 7 },
  priorityDeadlines: {},
};

/** Uso interno do pacote. */
export const orderKey = (i: QueueItem): OrderKey => ({
  confirmedUrgency: i.confirmedUrgency,
  risk: i.risk,
  priority: i.priority,
  number: i.number,
});

/**
 * `items` (da etapa `stage`) em ordem(RN-ORD) com as vagas dos idosos (RV7). O 80+ já chamado na etapa
 * que não voltou a esperar nela continua com a vaga de idoso que ocupou, pela chave da chamada: senão,
 * chamado ele, o idoso de 60-79 que ele passou voltaria à frente dos outros grupos, e a ordem mudaria
 * depois de cada chamada. Quem voltou a esperar (remoto ou presente, em qualquer metade da fila) ocupa a
 * vaga só pelo lugar de agora. Os de `gone` (já postos à frente) também guardam a vaga.
 * Uso interno do pacote (estimativa e chamada).
 */
export function stageOrder(day: SessionDay, stage: Stage, items: QueueItem[], gone: QueueItem[] = []): QueueItem[] {
  const ids = new Set(items.map((i) => i.id));
  const goneIds = new Set(gone.map((i) => i.id));
  const lastCall = new Map(day.calls.filter((c) => c.stage === stage).map((c) => [c.itemId, c]));
  const waiting = (i: QueueItem) => i.stage === stage && (i.state === "remote" || i.state === "present");
  const held = day.items.flatMap((i): QueueItem[] => {
    if (ids.has(i.id) || elderlyLevel(i.priority) !== 2) return [];
    if (goneIds.has(i.id)) return [i];
    const c = lastCall.get(i.id);
    if (!c || waiting(i)) return [];
    // Voltou a esperar na etapa depois da chamada (pulo, "Vou sair") e saiu da fila depois: não guarda a vaga.
    const backAfter = (t: number | null | undefined) => t != null && t > c.at;
    if (i.stage === stage && (backAfter(i.presentSince) || backAfter(i.leftAt))) return [];
    return [c.orderKey ? { ...i, ...c.orderKey } : i];
  });
  return orderItems([...items, ...held], orderKey, day.config.municipalityOrder).filter((i) => ids.has(i.id));
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
    const first = (items: QueueItem[]) => stageOrder(day, stage, items, placed)[0];
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

/**
 * Prazo de chegada de X (RN-ETA-06, AD-057, AD-076): da hora do "venha agora" da etapa atual até essa
 * hora mais o prazo da unidade. `null` enquanto X não recebeu "venha agora" desde que ficou remoto.
 */
function arrivalWindow(day: SessionDay, x: QueueItem): { start: number; end: number } | null {
  const notice = day.comeNow?.find((a) => a.itemId === x.id && a.stage === x.stage);
  if (!notice || (x.leftAt !== null && notice.at < x.leftAt)) return null;
  // Dias gravados antes da AD-057 não têm o prazo na config: vale o padrão.
  return {
    start: notice.at,
    end: notice.at + (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * 60_000,
  };
}

/** Fim do prazo de chegada de X; `null` enquanto X não recebeu "venha agora" desde que ficou remoto. */
export function arrivalDeadlineEnd(day: SessionDay, x: QueueItem): number | null {
  return arrivalWindow(day, x)?.end ?? null;
}

/**
 * AD-076: remoto que recebeu "venha agora" e não chegou no prazo perdeu a vez ("late"); chamadas de
 * outras pessoas não contam. O relógio do prazo para durante as quedas, registradas pela recepção
 * (AD-033) ou percebidas pelo sistema (`outages`, PV5 da AD-076): passado o prazo normal, mas não o estendido pela queda, está "late_in_contingency" e
 * ainda pode chegar. Presente, ou sem "venha agora", está "on_time".
 */
export function lateness(day: SessionDay, x: QueueItem, now: number): "on_time" | "late" | "late_in_contingency" {
  if (x.state !== "remote") return "on_time";
  const window = arrivalWindow(day, x);
  if (window === null || now < window.end) return "on_time";
  const end = extendedDeadlineEnd(day, x, now) as number;
  if (now < end) return "late_in_contingency";
  // Sinal da unidade parado desde antes do fim do prazo: pode ser uma queda ainda não confirmada, que volta
  // no tempo e estende o prazo; até lá, o atraso espera (PV5).
  // A queda começaria no último sinal, ou na volta da pausa se veio depois.
  const signalAt = stalledSince(day, now) ?? Number.NEGATIVE_INFINITY;
  return pendingOutage(day, now) && signalAt < end ? "late_in_contingency" : "late";
}

/** O fim do prazo de chegada estendido pelas quedas até `now` (a aberta vai até agora); nulo sem "venha agora". */
export function extendedDeadlineEnd(day: SessionDay, x: QueueItem, now: number): number | null {
  const window = arrivalWindow(day, x);
  if (window === null) return null;
  let end = window.end;
  let cursor = window.start;
  // Quedas registradas pela recepção e percebidas pelo sistema (a aberta vai até agora).
  const periods = [...day.contingencies, ...(day.outages ?? []).map((o) => ({ start: o.start, end: o.end ?? now }))];
  for (const c of periods.sort((a, b) => a.start - b.start)) {
    const from = Math.max(c.start, cursor);
    if (from > end) break;
    if (c.end <= from) continue;
    end += c.end - from;
    cursor = c.end;
  }
  return end;
}

/** A vez de X passou: perdeu o prazo de chegada, fora de contingência (AD-076). */
export function turnPassed(day: SessionDay, x: QueueItem, now: number): boolean {
  return lateness(day, x, now) === "late";
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
  const lostTurn = options.applyDelay && !x.confirmedUrgency && turnPassed(day, x, now);
  const lockedBehind = x.confirmedUrgency
    ? []
    : callOrder(
        // X volta a esperar: não guarda a vaga da chamada que acabou (RV7).
        { ...day, items: day.items.map((i) => (i.id === x.id ? { ...x, state: "present" as const } : i)) },
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
