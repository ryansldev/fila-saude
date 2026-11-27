import type { MyEntry } from "@fila-saude/schemas/queue";
import type { Tone } from "@/components/ui";
import type { Situation } from "./texts";

export type StepId = "sign_up" | "home" | "unit" | "triage" | "care";
/** `pendente`: é a etapa de agora, mas ainda não começou (a fila não abriu). */
export type StepState = "done" | "current" | "pending" | "future";
export type Step = { id: StepId; title: string; state: StepState };

const TITLES: Record<StepId, string> = {
  sign_up: "inscrição feita",
  home: "esperando em casa",
  unit: "na unidade",
  triage: "triagem",
  care: "atendimento",
};

const WITHOUT_ROW: Situation["kind"][] = ["cancelled", "left", "referred", "reassigned"];
const BEFORE_QUEUE: Situation["kind"][] = ["confirmed", "waiting", "late", "allocated"];

/**
 * Linha do tempo da tela da fila: as etapas pelas quais a pessoa passa hoje, com a de agora em
 * destaque. A triagem só aparece no serviço que tem triagem (RN-TRI-01); depois dela, a etapa de
 * agora é o atendimento, mesmo se a pessoa foi esperar em casa (RN-TRI-05). Quem terminou sem
 * atendimento não tem linha do tempo.
 */
export function queueSteps(en: MyEntry, sit: Situation): Step[] {
  if (WITHOUT_ROW.includes(sit.kind)) return [];
  const hasTriage = en.stage === "triage" || en.triaged;
  const ids: StepId[] = ["sign_up", "home", "unit", ...(hasTriage ? ["triage" as const] : []), "care"];
  const index = (id: StepId) => ids.indexOf(id);

  let current: number;
  let pending = false;
  if (sit.kind === "completed") current = ids.length;
  else if (sit.kind === "list" || sit.kind === "reserve") {
    current = index("sign_up");
    pending = true;
  } else if (BEFORE_QUEUE.includes(sit.kind)) {
    current = index("home");
    pending = true;
  } else if (sit.kind === "turn") current = index(en.stage === "triage" ? "triage" : "care");
  else if (en.triaged) current = index("care");
  else if ((sit.kind === "position" || sit.kind === "no_estimate") && sit.present) current = index("unit");
  else current = index("home");

  return ids.map((id, i) => ({
    id,
    title: TITLES[id],
    state: i < current ? "done" : i === current ? (pending ? "pending" : "current") : "future",
  }));
}

export type QueueHighlight = {
  tone: Tone;
  label: string;
  ticket: string | null;
  position?: number;
  minutes?: number;
  room?: string;
  /** RN-EST-06: uma pausa atrasa a vez; o tempo já a soma (sem `minutes`, a pausa não tem hora de volta). */
  paused?: true;
};

/**
 * O número do tempo na tela da fila. Com pausa, o tempo vale mesmo no 1º lugar (ninguém chama até a volta), e sem
 * hora de volta não há previsão; sem pausa, o 1º lugar (ou tempo zero) é "já já".
 */
export function waitFigure(h: QueueHighlight): { value: string; legend: string } {
  const minutes = h.minutes ?? 0;
  if (h.paused) {
    if (h.minutes === undefined) return { value: "sem previsão", legend: "a pausa não tem hora de volta" };
    return { value: `~${minutes} min`, legend: "para a sua vez" };
  }
  const first = (h.position ?? 0) <= 1;
  return {
    value: first || minutes <= 0 ? "já já" : `~${minutes} min`,
    legend: first ? "você é o próximo" : "para a sua vez",
  };
}

/** O topo da tela da fila: a senha bem grande e, na fila, a posição e o tempo. */
export function queueHighlight(en: MyEntry, sit: Situation): QueueHighlight {
  const ticket = en.ticket;
  switch (sit.kind) {
    case "turn":
      return {
        tone: "green",
        label: "é a sua vez!",
        ticket: sit.ticket,
        room: sit.station?.toLowerCase() ?? "veja a sala na TV",
      };
    case "come":
      return { tone: "yellow", label: "venha agora", ticket };
    case "reception":
      return { tone: "yellow", label: "mostre na recepção", ticket };
    case "position":
      // RN-EST-06: a pausa troca o rótulo; sem hora de volta, o tempo não vale e sai.
      if (sit.pause) {
        const { title, noReturn } = sit.pause;
        return noReturn
          ? { tone: "yellow", label: title, ticket, position: sit.position, paused: true }
          : { tone: "yellow", label: title, ticket, position: sit.position, minutes: sit.minutes, paused: true };
      }
      return { tone: "blue", label: "sua senha", ticket, position: sit.position, minutes: sit.minutes };
    case "no_estimate":
      return { tone: "blue", label: "sua senha", ticket };
    case "completed":
      return { tone: "green", label: "atendimento concluído", ticket };
    case "referred":
      return { tone: "red", label: "encaminhado à emergência", ticket };
    case "left":
      return { tone: "red", label: "você saiu da fila", ticket };
    case "cancelled":
      return { tone: "gray", label: "inscrição cancelada", ticket: null };
    case "reassigned":
      return { tone: "gray", label: "a unidade vai marcar outra data", ticket: null };
    default:
      return { tone: "gray", label: "a senha sai quando a fila abrir", ticket: null };
  }
}
