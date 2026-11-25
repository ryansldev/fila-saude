import { instantToLocal, localToInstant } from "@fila-saude/domain";
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

// ---- Pausa (RN-EST-06) ----

const MIN = 60_000;
/** A hora `HH:MM` do instante no fuso da unidade. */
const hhmm = (t: number, timeZone: string) => instantToLocal(t, timeZone).slice(11, 16);
/** Menos de um minuto até o início: a pausa começa agora (sem ninguém a caminho). */
const startsNow = (startsAt: string, now: number) => Date.parse(startsAt) - now < MIN;

/** A caixa do painel "Pausar a estação": quando a pausa começa. */
export function pauseStartText(startsAt: string, now: number, timeZone: string): string {
  if (startsNow(startsAt, now)) return "A pausa começa agora.";
  const t = Date.parse(startsAt);
  const min = Math.round((t - now) / MIN);
  return `A pausa começa às ${hhmm(t, timeZone)}, daqui a ${min} min: quem já está a caminho chega e é atendido. Até lá, chame normalmente.`;
}

/** O botão que confirma a pausa. */
export function pauseActionText(startsAt: string, now: number, timeZone: string): string {
  return startsNow(startsAt, now) ? "Pausar agora" : `Pausar às ${hhmm(Date.parse(startsAt), timeZone)}`;
}

export type BackChoice = "none" | "30" | "60" | "at";
type BackBody = { at: string } | { inMin: number } | null;

/**
 * A volta escolhida: o corpo de "pausar" e a hora prevista (`until`, para o texto). O horário é do dia do início da
 * pausa, no fuso da unidade, e precisa ser depois dele.
 */
export function pauseBack(
  choice: BackChoice,
  time: string,
  startsAt: string,
  timeZone: string,
): { back: BackBody; until: number | null } | { error: string } {
  const start = Date.parse(startsAt);
  if (choice === "none") return { back: null, until: null };
  if (choice !== "at") {
    const inMin = Number(choice);
    return { back: { inMin }, until: start + inMin * MIN };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Escolha o horário da volta." };
  const until = localToInstant(`${instantToLocal(start, timeZone).slice(0, 10)}T${time}`, timeZone);
  if (until <= start) return { error: `A volta precisa ser depois do início da pausa (${hhmm(start, timeZone)}).` };
  return { back: { at: new Date(until).toISOString() }, until };
}

/** A frase da volta, embaixo da escolha. */
export function backText(until: number | null, timeZone: string): string {
  return until === null
    ? 'Sem hora de volta: a estação fica em pausa até você tocar em "Voltar agora".'
    : `Volta às ${hhmm(until, timeZone)}.`;
}

/** O cartão "Em pausa": desde quando. */
export function pausedText(from: string, timeZone: string): string {
  return `Desde ${hhmm(Date.parse(from), timeZone)}. A fila espera a sua volta.`;
}

/** A pílula da volta: amarela até a hora, vermelha depois ("devia ter voltado"); sem hora de volta, nenhuma. */
export function pausedPill(
  until: string | null,
  now: number,
  timeZone: string,
): { text: string; late: boolean } | null {
  if (until === null) return null;
  const t = Date.parse(until);
  return now < t
    ? { text: `volta às ${hhmm(t, timeZone)}`, late: false }
    : { text: `devia ter voltado às ${hhmm(t, timeZone)}`, late: true };
}
