import type { ChamadaNaTv } from "@fila-saude/schemas/tv";

/** RN-TV-07: o que já foi visto, o que espera para ser anunciado e o anúncio em destaque. */
export type Anuncios = {
  iniciado: boolean;
  vistas: string[];
  fila: ChamadaNaTv[];
  atual: { chamada: ChamadaNaTv; ate: number } | null;
};

export const ANUNCIOS_VAZIOS: Anuncios = { iniciado: false, vistas: [], fila: [], atual: null };

const LIMITE_DE_VISTAS = 50;

/**
 * Junta as chamadas da última leitura. Na primeira, só guarda o histórico (não anuncia o que já passou).
 * As novas entram na fila da mais antiga para a mais nova; rechamar gera uma chamada nova (outro horário).
 */
export function receberChamadas(
  e: Anuncios,
  chamadas: ChamadaNaTv[],
  agora = Number.POSITIVE_INFINITY,
  maxAtrasoMs = Number.POSITIVE_INFINITY,
): Anuncios {
  const ids = chamadas.map((c) => c.id);
  if (!e.iniciado) return { ...e, iniciado: true, vistas: ids };
  const novas = chamadas.filter((c) => !e.vistas.includes(c.id)).sort((a, b) => a.em.localeCompare(b.em));
  if (novas.length === 0) return e;
  // Depois de uma queda, as chamadas que passaram há muito tempo só vão para o histórico.
  const recentes = novas.filter((c) => agora - Date.parse(c.em) <= maxAtrasoMs);
  return {
    ...e,
    vistas: [...novas.map((c) => c.id), ...e.vistas].slice(0, LIMITE_DE_VISTAS),
    fila: [...e.fila, ...recentes],
  };
}

/** "Últimas chamadas": as já anunciadas (nem na fila de anúncios, nem a do destaque). */
export function ultimasAnunciadas(e: Anuncios, chamadas: ChamadaNaTv[]): ChamadaNaTv[] {
  const pendentes = new Set([...e.fila.map((c) => c.id), ...(e.atual ? [e.atual.chamada.id] : [])]);
  return chamadas.filter((c) => !pendentes.has(c.id));
}

/** Cada anúncio fica `destaqueMs` em destaque; ao trocar, a TV toca o aviso (RN-TV-04). */
export function avancarAnuncios(e: Anuncios, agora: number, destaqueMs: number): { estado: Anuncios; tocar: boolean } {
  if (e.atual && agora < e.atual.ate) return { estado: e, tocar: false };
  const [proxima, ...resto] = e.fila;
  if (!proxima) return { estado: e.atual ? { ...e, atual: null } : e, tocar: false };
  return { estado: { ...e, fila: resto, atual: { chamada: proxima, ate: agora + destaqueMs } }, tocar: true };
}
