import type { OperacaoEstacao } from "@fila-saude/schemas/fila";
import { minutosDesde } from "@/lib/fila";

/** Chamado e esperando entrar, ou já na sala ("Compareceu"). */
export const faseDoChamado = (c: { compareceuEm: string | null }): "chamado" | "na_sala" =>
  c.compareceuEm === null ? "chamado" : "na_sala";

/** "há 12 min"; abaixo de 1 minuto, "agora". */
export function textoDaEspera(desde: string, agora: number): string {
  const min = minutosDesde(desde, agora);
  return min === 0 ? "agora" : `há ${min} min`;
}

/** A pílula "o mais antigo há X": vermelha quando passa do tempo-alvo de quem espera. */
export function pilulaDoMaisAntigo(
  m: OperacaoEstacao["maisAntigo"],
  agora: number,
): { texto: string; atrasado: boolean } | null {
  if (!m) return null;
  const min = minutosDesde(m.presenteDesde, agora);
  const texto = min === 0 ? "o mais antigo chegou agora" : `o mais antigo há ${min} min`;
  return { texto, atrasado: min > m.tempoAlvoMin };
}
