/**
 * Horário em faixas (RN-SES-06): a sessão guarda o início da primeira faixa, o fim da última e os intervalos (os
 * vãos entre as faixas), que viram a pausa planejada de todas as estações (`SessionDay.breaks`).
 */

export type Band = { start: number; end: number };

const OVERLAP = "as faixas não podem se sobrepor";
const END_AFTER = "fim deve ser depois do início";

/** As faixas digitadas (em qualquer ordem) → início, fim e intervalos; recusa faixa vazia, invertida ou sobreposta. */
export function fromBands(
  bands: readonly Band[],
): { ok: true; start: number; end: number; breaks: Band[] } | { ok: false; error: string } {
  if (bands.length === 0) return { ok: false, error: "inclua um horário" };
  if (bands.some((b) => b.end <= b.start)) return { ok: false, error: END_AFTER };
  const sorted = [...bands].sort((a, b) => a.start - b.start);
  const breaks: Band[] = [];
  for (let k = 1; k < sorted.length; k++) {
    const before = sorted[k - 1] as Band;
    const b = sorted[k] as Band;
    // Encostadas (12:00 às 12:00) também: seriam uma faixa só, sem intervalo.
    if (b.start <= before.end) return { ok: false, error: OVERLAP };
    breaks.push({ start: before.end, end: b.start });
  }
  return { ok: true, start: (sorted[0] as Band).start, end: (sorted.at(-1) as Band).end, breaks };
}

/** Início, fim e intervalos → as faixas, em ordem. */
export function toBands(start: number, end: number, breaks: readonly Band[]): Band[] {
  const sorted = [...breaks].sort((a, b) => a.start - b.start);
  const bands: Band[] = [];
  let from = start;
  for (const b of sorted) {
    bands.push({ start: from, end: b.start });
    from = b.end;
  }
  bands.push({ start: from, end });
  return bands;
}

/** O erro dos intervalos gravados com a sessão (dentro do horário, cada um com fim depois do início, sem se sobrepor). */
export function breaksError(start: number, end: number, breaks: readonly Band[]): string | null {
  if (breaks.some((b) => b.end <= b.start)) return END_AFTER;
  if (breaks.some((b) => b.start <= start || b.end >= end)) return "o intervalo fica dentro do horário da sessão";
  const sorted = [...breaks].sort((a, b) => a.start - b.start);
  for (let k = 1; k < sorted.length; k++) {
    if ((sorted[k] as Band).start <= (sorted[k - 1] as Band).end) return OVERLAP;
  }
  return null;
}
