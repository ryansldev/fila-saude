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
export function receberChamadas(e: Anuncios, chamadas: ChamadaNaTv[]): Anuncios {
  const ids = chamadas.map((c) => c.id);
  if (!e.iniciado) return { ...e, iniciado: true, vistas: ids };
  const novas = chamadas.filter((c) => !e.vistas.includes(c.id)).sort((a, b) => a.em.localeCompare(b.em));
  if (novas.length === 0) return e;
  return {
    ...e,
    vistas: [...novas.map((c) => c.id), ...e.vistas].slice(0, LIMITE_DE_VISTAS),
    fila: [...e.fila, ...novas],
  };
}

/** Cada anúncio fica `destaqueMs` em destaque; ao trocar, a TV toca o aviso (RN-TV-04). */
export function avancarAnuncios(e: Anuncios, agora: number, destaqueMs: number): { estado: Anuncios; tocar: boolean } {
  if (e.atual && agora < e.atual.ate) return { estado: e, tocar: false };
  const [proxima, ...resto] = e.fila;
  if (!proxima) return { estado: e.atual ? { ...e, atual: null } : e, tocar: false };
  return { estado: { ...e, fila: resto, atual: { chamada: proxima, ate: agora + destaqueMs } }, tocar: true };
}
