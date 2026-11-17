import type { Situation } from "@/lib/texts";

/** Quem vira o bilhete da aba "hoje": o que mais pede ação agora vem primeiro. */
function weight(sit: Situation): number {
  switch (sit.kind) {
    case "turn":
      return 0;
    case "come":
      return 1;
    case "reception":
      return 2;
    case "position":
      return sit.present ? 3 : 4;
    case "no_estimate":
      return sit.present ? 3 : 5;
    case "allocated":
      return 6;
    case "waiting":
    case "late":
    case "confirmed":
      return 7;
    default:
      return 8;
  }
}

const positionOf = (sit: Situation) => (sit.kind === "position" ? sit.position : Number.POSITIVE_INFINITY);

/** Os atendimentos do dia na ordem da aba: o primeiro é o bilhete; na fila em casa, a menor posição primeiro. */
export function sortForDay<T extends { sit: Situation }>(items: T[]): T[] {
  return [...items].sort((a, b) => weight(a.sit) - weight(b.sit) || positionOf(a.sit) - positionOf(b.sit));
}

export type TicketCard = { banner: string; ticket: string | null; button: "qr" | "confirm" | null };

/** O bilhete: a faixa com o que fazer, a senha (se já tem) e o botão da situação. */
export function ticketCardFor(en: { ticket: string | null; itemState: string | null }, sit: Situation): TicketCard {
  const atHome = en.itemState === "remote";
  const qr = atHome ? ("qr" as const) : null;
  switch (sit.kind) {
    case "come":
      return { banner: "venha agora!", ticket: en.ticket, button: qr };
    case "reception":
      return { banner: "mostre na recepção", ticket: en.ticket, button: null };
    case "position":
    case "no_estimate":
      return sit.present
        ? { banner: "você está na unidade", ticket: en.ticket, button: null }
        : { banner: "você está na fila", ticket: en.ticket, button: qr };
    case "allocated":
      return { banner: "confirme a sua data", ticket: null, button: "confirm" };
    case "late":
      return { banner: "a fila vai abrir", ticket: en.ticket, button: null };
    default:
      return { banner: "a fila ainda não abriu", ticket: en.ticket, button: null };
  }
}

/** A linha de "também hoje": o quadro com a posição (quando há) e uma frase curta. */
export function rowFor(sit: Situation): { box: string | null; sentence: string } {
  switch (sit.kind) {
    case "position":
      return {
        box: `${sit.position}º`,
        sentence: sit.position <= 1 || sit.minutes <= 0 ? "você é o próximo" : `cerca de ${sit.minutes} min`,
      };
    case "come":
      return { box: null, sentence: "venha agora" };
    case "reception":
      return { box: null, sentence: "mostre na recepção" };
    case "no_estimate":
      return { box: null, sentence: "sem previsão agora" };
    case "allocated":
      return { box: null, sentence: "confirme a sua data" };
    default:
      return { box: null, sentence: "a fila ainda não abriu" };
  }
}

/** O número nas abas de baixo: em "atendimentos", os de outros dias e os sem data (o de hoje já está em "hoje"). */
export function tabCount(list: { summary: { group: string } }[]): { appointments?: number } {
  const appointments = list.filter((x) => x.summary.group === "upcoming" || x.summary.group === "no_date").length;
  return appointments > 0 ? { appointments } : {};
}
