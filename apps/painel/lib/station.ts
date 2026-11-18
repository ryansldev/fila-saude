import type { StationOperation } from "@fila-saude/schemas/queue";
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
