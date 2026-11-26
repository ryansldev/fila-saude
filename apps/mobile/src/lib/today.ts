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
      // RN-SES-05: em modo manual, procure a recepção; o QR continua (a unidade sem TV pode tê-lo).
      if (sit.kind === "no_estimate" && sit.manual)
        return { banner: "procure a recepção", ticket: en.ticket, button: qr };
      // Opção C: a estação pausou antes de chamar quem chegou no prazo.
      if (sit.kind === "position" && sit.present && sit.pause?.beforeTurn)
        return { banner: "pausa antes da sua vez", ticket: en.ticket, button: null };
      if (sit.present) return { banner: "você está na unidade", ticket: en.ticket, button: null };
      // RN-EST-06: em casa, a pausa que atrasa a vez vira a faixa ("pausa, volta às 13h32").
      if (sit.kind === "position" && sit.pause) return { banner: sit.pause.title, ticket: en.ticket, button: qr };
      return { banner: "você está na fila", ticket: en.ticket, button: qr };
    case "allocated":
      return { banner: "confirme a sua data", ticket: null, button: "confirm" };
    case "late":
      return { banner: "a fila vai abrir", ticket: en.ticket, button: null };
    case "reserve":
      return { banner: "você está na reserva", ticket: null, button: null };
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
        // Como na tela da fila: "o próximo" só na 1ª posição; tempo zero mais atrás é "já já".
        // Com pausa, o tempo (que a soma) vale mesmo no 1º lugar; sem hora de volta, a pausa é o que se sabe.
        sentence: sit.pause?.noReturn
          ? sit.pause.title
          : sit.pause
            ? `cerca de ${sit.minutes} min`
            : sit.position <= 1
              ? "você é o próximo"
              : sit.minutes <= 0
                ? "já já"
                : `cerca de ${sit.minutes} min`,
      };
    case "come":
      return { box: null, sentence: "venha agora" };
    case "reception":
      return { box: null, sentence: "mostre na recepção" };
    case "no_estimate":
      return { box: null, sentence: sit.manual ? "modo manual: procure a recepção" : "sem previsão agora" };
    case "allocated":
      return { box: null, sentence: "confirme a sua data" };
    case "turn":
      return { box: null, sentence: "é a sua vez" };
    case "reserve":
      return { box: null, sentence: "na reserva: se alguém desistir, a vaga é sua" };
    case "late":
      return { box: null, sentence: "a fila vai abrir" };
    default:
      return { box: null, sentence: "a fila ainda não abriu" };
  }
}

/** O número nas abas de baixo: em "atendimentos", os de outros dias e os sem data (o de hoje já está em "hoje"). */
export function tabCount(list: { summary: { group: string } }[]): { appointments?: number } {
  const appointments = list.filter((x) => x.summary.group === "upcoming" || x.summary.group === "no_date").length;
  return appointments > 0 ? { appointments } : {};
}
