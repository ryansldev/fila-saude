import { instantToLocal } from "@fila-saude/domain";
import type { StationOperation } from "@fila-saude/schemas/queue";
import { ApiError } from "@/lib/api";
import { minutesSince } from "@/lib/queue";

/** Chamado e esperando entrar, ou já na sala ("Compareceu"). */
export const calledPhase = (c: { showedUpAt: string | null }): "called" | "in_room" =>
  c.showedUpAt === null ? "called" : "in_room";

/** "há 12 min"; abaixo de 1 minuto, "agora". */
export function waitText(since: string, now: number): string {
  const min = minutesSince(since, now);
  return min === 0 ? "agora" : `há ${min} min`;
}

/** A pílula "o mais antigo há X": vermelha quando passa do tempo-alvo de quem espera. */
export function oldestPill(m: StationOperation["oldest"], now: number): { text: string; late: boolean } | null {
  if (!m) return null;
  const min = minutesSince(m.presentSince, now);
  const text = min === 0 ? "o mais antigo chegou agora" : `o mais antigo há ${min} min`;
  return { text, late: min > m.targetTimeMin };
}

/** RN-EST-07: o texto do quadro da estação fechada, com a hora na unidade (sem o fuso, a deste computador). */
export function closedText(name: string, closedAt: string, timeZone: string | null): string {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${name} fechou às ${instantToLocal(Date.parse(closedAt), zone).slice(11, 16)}. Não chama mais nesta sessão.`;
}

type Closing = StationOperation["station"]["closing"];

/**
 * RN-EST-07: a confirmação de "Fechar a estação". Fechar é de verdade (a pausa é que é passageira); sendo a
 * última aberta, diz que encerra a sessão (atendimento) ou fecha a triagem de hoje.
 */
export function closeConfirm(name: string, closing: Closing): { title: string; description: string; action: string } {
  if (closing === "closes_session") {
    return {
      title: `Fechar ${name} e encerrar a sessão?`,
      description:
        "É a última estação aberta do atendimento: sem ela, ninguém mais seria atendido hoje. A sessão é encerrada e quem ainda espera é remanejado (ou leva falta, se perdeu o prazo de chegada). Não dá para desfazer.",
      action: "Fechar e encerrar",
    };
  }
  if (closing === "closes_stage") {
    return {
      title: `Fechar ${name} e a triagem de hoje?`,
      description:
        "É a última estação aberta da triagem. Quem espera a triagem é remanejado (ou leva falta, se perdeu o prazo de chegada), e a sessão não aceita gente nova até a triagem reabrir. Quem já passou pela triagem segue no atendimento.",
      action: "Fechar a triagem",
    };
  }
  return {
    title: `Fechar ${name}?`,
    description:
      "Ela não chama mais nesta sessão e sai da previsão de tempo dos pacientes. Use quando o atendimento desta sala acabou hoje. Dá para reabrir.",
    action: "Fechar",
  };
}

/** A API recusou o "Fechar" porque, nesse meio-tempo, a estação virou a última aberta: o que a próxima confirmação diz. */
export function closingFromError(e: unknown): Closing {
  if (!(e instanceof ApiError)) return null;
  return e.error === "closes_session" || e.error === "closes_stage" ? e.error : null;
}

/** O aviso que a resposta do comando traz, na faixa da estação. */
export function noticeText(notice: StationOperation["notice"]): { text: string; kind: "ok" } | null {
  if (notice === "nobody_waiting") return { text: "Ninguém que esta estação possa chamar agora.", kind: "ok" };
  if (notice === "session_closed") {
    return { text: "A sessão foi encerrada: esta era a última estação aberta do atendimento.", kind: "ok" };
  }
  return null;
}
