import type { MyEntry } from "@fila-saude/schemas/queue";
import { ApiError } from "./api";
import { hour, isToday, shortDay } from "./dates";

/** Estado de uma entrada na tela "minha fila", na mesma divisão das telas do design do app. */
export type Situation =
  | { kind: "turn"; ticket: string; station: string | null }
  | { kind: "reception" }
  | { kind: "come" }
  | { kind: "position"; position: number; minutes: number; present: boolean; leave: boolean }
  /** Sessão ainda planejada e antes do horário. */
  | { kind: "waiting" }
  /** Fila aberta, mas sem previsão (nenhuma estação aberta, modo manual, fora da ordem): nunca "vai começar". */
  | { kind: "no_estimate"; present: boolean }
  | { kind: "confirmed" }
  /** Passou do horário de início e a unidade ainda não abriu a fila (abertura por botão na v0.1). */
  | { kind: "late" }
  | { kind: "allocated" }
  | { kind: "reserve" }
  | { kind: "list" }
  | { kind: "completed" }
  /** A triagem encaminhou à emergência (H2): não é atendimento concluído. */
  | { kind: "referred" }
  | { kind: "reassigned" }
  | { kind: "left" }
  | { kind: "cancelled" };

/** T3.4 / RN-ETA / RN-FILA-05: o que a tela mostra para cada entrada, olhando o estado e o relógio. */
export function entrySituation(e: MyEntry, now: number): Situation {
  // Fim da entrada primeiro: cancelada ou arquivada nunca é "não compareceu".
  if (e.state === "cancelled" || e.state === "archived") return { kind: "cancelled" };
  if (e.itemState === "called" && e.ticket) {
    return { kind: "turn", ticket: e.ticket, station: e.call?.station ?? null };
  }
  if (e.referred) return { kind: "referred" };
  if (e.state === "completed" || e.itemState === "done_in_stage") return { kind: "completed" };
  if (e.state === "reassigned") return { kind: "reassigned" };
  if (e.state === "closed_without_care" || e.itemState === "left_queue") return { kind: "left" };
  if (e.state === "in_reserve") return { kind: "reserve" };
  const beforeStart = !e.session || now < Date.parse(e.session.start);
  if (e.state === "confirmed") {
    if (e.session?.state === "planned" && !beforeStart) return { kind: "late" };
    return { kind: "confirmed" };
  }
  if (e.state === "allocated" && e.session) return { kind: "allocated" };
  if (e.state === "waiting" || e.state === "allocated" || e.state === "awaiting_referral") return { kind: "list" };
  if (e.itemState === "remote" && e.pendingChecks.length > 0) return { kind: "reception" };
  const est = e.estimate;
  if (est?.kind === "come_now") return { kind: "come" };
  if (est?.kind === "position") {
    const present = e.itemState === "present";
    return { kind: "position", position: est.position, minutes: est.minutes, present, leave: !present && e.leaveHome };
  }
  if (e.session?.state === "planned") return beforeStart ? { kind: "waiting" } : { kind: "late" };
  return { kind: "no_estimate", present: e.itemState === "present" };
}

const MESSAGES: Record<string, string> = {
  no_connection: "sem internet. confira a conexão e tente de novo.",
  not_authenticated: "sua sessão expirou. entre de novo.",
  no_permission: "o servidor recusou o pedido. feche o app, abra de novo e tente outra vez.",
  too_many_attempts: "muitas tentativas seguidas. espere um minuto e tente de novo.",
  credentials: "CPF ou senha incorretos.",
  duplicate: "essa pessoa já está inscrita neste atendimento.",
  emergency: "isso pode ser uma emergência. ligue 192.",
  private_session: "este atendimento é só por agendamento da unidade.",
  session_closed: "este atendimento já foi encerrado.",
  regulated_service: "este atendimento é marcado pela regulação.",
  referral_pending: "este atendimento pede requisição médica.",
  invalid_cpf: "CPF inválido.",
  invalid_input: "confira os dados preenchidos.",
  invalid_qr: "QR vencido. leia de novo o QR da unidade.",
};

/** Primeira letra minúscula (o app escreve assim); siglas como "QR" e "CPF" ficam como estão. */
const appStyle = (t: string) => (/^[A-ZÀ-Ú][a-zà-ú]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/** O texto do app para o código vem primeiro; sem ele, o da API, no estilo do app (minúsculas). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const text = MESSAGES[e.error] ?? e.userMessage;
    return text
      ? appStyle(text).replace(/\. ([A-ZÀ-Ú][a-zà-ú])/g, (_, c: string) => `. ${c.toLowerCase()}`)
      : "não deu certo. tente de novo.";
  }
  return "não deu certo. tente de novo.";
}

/** Faixa de erro de uma tela: "sem internet" só quando a rede falhou; o resto diz o motivo. */
export function errorNotice(
  e: unknown,
  offline = "a sua posição volta a aparecer quando a conexão voltar.",
): { title: string; text: string } {
  if (e instanceof ApiError && e.error === "no_connection") return { title: "sem internet", text: offline };
  return { title: "não deu para atualizar", text: errorMessage(e) };
}

export type Tone = "blue" | "green" | "yellow" | "gray" | "red";

/**
 * O que a "minha fila" mostra no topo de cada atendimento, para não haver dúvida:
 * - `inQueue`: já tem senha na fila do dia (em casa ou na unidade). Lista de espera, reserva e
 *   inscrição para outro dia ainda NÃO são fila.
 * - `etapa`: posição na trilha inscrição (0) → fila (1) → unidade (2) → sala (3) → atendido (4);
 *   `null` quando terminou sem atendimento (cancelado, saiu, remanejado).
 * - `grupo`: seção da tela (hoje, próximos, sem data, encerrados).
 */
export function entrySummary(
  en: MyEntry,
  sit: Situation,
  now: number,
): {
  badge: string;
  tone: Tone;
  inQueue: boolean;
  stage: number | null;
  group: "today" | "upcoming" | "no_date" | "closed";
} {
  const base = (() => {
    switch (sit.kind) {
      case "list":
        return { badge: "lista de espera", tone: "gray" as Tone, inQueue: false, stage: 0 };
      case "reserve":
        return { badge: "na reserva", tone: "yellow" as Tone, inQueue: false, stage: 0 };
      case "allocated":
        return { badge: "data marcada", tone: "blue" as Tone, inQueue: false, stage: 0 };
      case "confirmed":
      case "waiting":
      case "late":
        return { badge: "inscrito", tone: "blue" as Tone, inQueue: false, stage: 1 };
      case "reception":
        return { badge: "recepção", tone: "yellow" as Tone, inQueue: true, stage: 1 };
      case "come":
        return { badge: "venha agora", tone: "yellow" as Tone, inQueue: true, stage: 1 };
      case "position":
        if (sit.present) return { badge: "na unidade", tone: "green" as Tone, inQueue: true, stage: 2 };
        if (sit.leave) return { badge: "saia de casa", tone: "yellow" as Tone, inQueue: true, stage: 1 };
        return { badge: "na fila", tone: "blue" as Tone, inQueue: true, stage: 1 };
      case "no_estimate":
        return sit.present
          ? { badge: "na unidade", tone: "green" as Tone, inQueue: true, stage: 2 }
          : { badge: "na fila", tone: "blue" as Tone, inQueue: true, stage: 1 };
      case "turn":
        return { badge: "sua vez", tone: "green" as Tone, inQueue: true, stage: 3 };
      case "completed":
        return { badge: "atendido", tone: "green" as Tone, inQueue: false, stage: 4 };
      case "referred":
        return { badge: "emergência", tone: "red" as Tone, inQueue: false, stage: null };
      case "reassigned":
        // Continua no serviço: a unidade marca outra data (não é encerrada).
        return { badge: "nova data", tone: "gray" as Tone, inQueue: false, stage: 0 };
      case "left":
        return { badge: "saiu", tone: "red" as Tone, inQueue: false, stage: null };
      case "cancelled":
        return { badge: "cancelado", tone: "gray" as Tone, inQueue: false, stage: null };
    }
  })();
  const finished = ["completed", "referred", "left", "cancelled"].includes(sit.kind);
  const group = finished
    ? "closed"
    : !en.session || sit.kind === "reassigned"
      ? "no_date"
      : base.inQueue || isToday(en.session.start, now, en.timeZone)
        ? "today"
        : "upcoming";
  return { ...base, group };
}

/** A faixa depois do "não vou poder ir" diz o que aconteceu, pelo tipo da inscrição. */
export function cancellationNotice(sit: Pick<Situation, "kind">): string {
  if (sit.kind === "reserve") return "você saiu da reserva.";
  if (sit.kind === "list") return "você saiu da lista de espera.";
  return "a vaga fica para outra pessoa.";
}

// RN-TRI-01/04: na unidade, o app diz em que etapa a pessoa está (a cor da triagem não aparece, H5).
function inUnit(e: MyEntry): string {
  if (e.triaged) return "triagem feita. agora, o atendimento: fique de olho na TV.";
  if (e.stage === "triage") return "você está na unidade. primeiro, a triagem: fique de olho na TV.";
  return "você está na unidade. fique de olho na TV.";
}

/**
 * RN-PIORA-01 (H6): quem já está na unidade não muda o risco pelo app; avisa no local ou liga 192.
 */
export const WORSENED_GUIDANCE =
  "avise agora a recepção ou a enfermagem: eles reavaliam você na hora. se for uma emergência, ligue 192.";

/** O que fazer agora, numa frase curta (cartão do atendimento). O "quando" e o "onde" ficam no cartão. */
export function nextStep(e: MyEntry, sit: Situation, now: number): string {
  switch (sit.kind) {
    case "turn":
      return "é a sua vez! vá para a sala.";
    case "list":
      return "a unidade vai marcar a data e te avisar.";
    case "reserve":
      return "se alguém desistir, a vaga é sua. avisamos aqui.";
    case "allocated":
      return e.confirmationDeadline
        ? `confirme até ${shortDay(e.confirmationDeadline, e.timeZone)}, às ${hour(e.confirmationDeadline, e.timeZone)}.`
        : "a unidade marcou este horário para você.";
    case "confirmed":
    case "waiting": {
      if (!e.session) return "avisamos quando a fila abrir.";
      const opens = hour(e.session.start, e.timeZone);
      return isToday(e.session.start, now, e.timeZone)
        ? `a fila abre às ${opens}. até lá, pode esperar em casa.`
        : `no dia, a fila abre às ${opens}. avisamos quando abrir.`;
    }
    case "late":
      return "a unidade ainda não abriu a fila. avisamos quando abrir.";
    case "position":
      if (sit.present) return inUnit(e);
      return sit.leave ? "saia agora para chegar a tempo." : "pode esperar em casa. avisamos a hora de sair.";
    case "no_estimate":
      return sit.present ? inUnit(e) : "a fila já começou. avisamos quando estiver perto.";
    case "come":
      return "venha agora. ao chegar, leia o QR da TV.";
    case "reception":
      return "passe na recepção com um documento com foto. só na primeira vez.";
    case "completed":
      return "atendimento concluído. cuide-se!";
    case "referred":
      return "a enfermagem encaminhou você para a emergência. siga a orientação da equipe.";
    case "reassigned":
      return "a sua vez não chegou. a unidade vai marcar outra data.";
    case "left":
      return "você foi chamado e não apareceu. fale com a recepção.";
    case "cancelled":
      return "inscrição cancelada.";
  }
}

/**
 * RN-CONF-04 / RN-REM-03: depois de "não posso nesta data". Volta para a lista, menos na 2ª recusa de
 * quem foi remanejado, que encerra o pedido; o texto segue o estado que a API devolveu.
 */
export const refusalNotice = (state: string): string =>
  state === "cancelled"
    ? "a vaga fica para outra pessoa. como já era a segunda data recusada, o pedido foi encerrado. se ainda precisar, fale com a unidade."
    : "a vaga fica para outra pessoa. você continua na lista de espera.";

/**
 * RN-CANC-01 / RN-CONF-04: o botão de sair e o que acontece. Quem está alocado e só não pode na data
 * recusa a data ("não posso nesta data") e continua na lista; sair da lista encerra o pedido.
 */
export function cancellationText(sit: Situation): { button: string; effect: string; hint: string } {
  if (sit.kind === "allocated")
    return {
      button: "sair da lista de espera",
      effect: "você sai da lista de espera.",
      hint: 'se só esta data não dá, toque em "não posso nesta data": você continua na lista.',
    };
  if (sit.kind === "list")
    return { button: "sair da lista de espera", effect: "você sai da lista de espera.", hint: "" };
  if (sit.kind === "reserve")
    return {
      button: "não vou poder ir",
      effect: "você sai da reserva.",
      hint: "para outro dia, faça uma nova inscrição.",
    };
  return {
    button: "não vou poder ir",
    effect: "você perde esta vaga.",
    hint: "para outro dia, faça uma nova inscrição.",
  };
}
