import { type PrioridadeLegal, rankPrioridade } from "./prioridade.ts";
import type { NivelRisco } from "./tipos.ts";

type Risco = Exclude<NivelRisco, "emergencia">;
type OrdemMunicipio = "risco" | "prioridade";

const PESO_RISCO: Record<Risco, number> = { urgente: 2, atencao: 1, rotina: 0 };

/** Chave da ordem de chamada (RN-ORD). `risco` é o vigente: confirmado, se houver; senão, sugerido. */
export type ChaveOrdem = {
  urgenciaConfirmada: boolean;
  risco: Risco;
  prioridade: PrioridadeLegal;
  numero: number;
};

/** Chave da ordem da sugestão de alocação (RN-AL-02). */
export type ChaveSugestao = {
  urgenciaConfirmada: boolean;
  remanejada: boolean;
  risco: Risco;
  prioridade: PrioridadeLegal;
  dataEntradaOriginal: number;
  id: string;
};

const sinal = (n: number): number => (n < 0 ? -1 : n > 0 ? 1 : 0);

/** Maior vem antes: negativo quando `a` precede `b`. */
const maiorPrimeiro = (a: number, b: number): number => sinal(b - a);

function criterios(
  a: { risco: Risco; prioridade: PrioridadeLegal },
  b: { risco: Risco; prioridade: PrioridadeLegal },
  ordemMunicipio: OrdemMunicipio,
): number {
  const risco = maiorPrimeiro(PESO_RISCO[a.risco], PESO_RISCO[b.risco]);
  const legal = maiorPrimeiro(rankPrioridade(a.prioridade), rankPrioridade(b.prioridade));
  return ordemMunicipio === "risco" ? risco || legal : legal || risco;
}

/** Ordem total: urgência confirmada, risco e prioridade (na ordem do município), número. */
export function compararOrdem(a: ChaveOrdem, b: ChaveOrdem, ordemMunicipio: OrdemMunicipio): number {
  return (
    maiorPrimeiro(Number(a.urgenciaConfirmada), Number(b.urgenciaConfirmada)) ||
    criterios(a, b, ordemMunicipio) ||
    sinal(a.numero - b.numero)
  );
}

/** Urgência, remanejadas, risco e prioridade (ordem do município), data original, id. */
export function compararSugestao(a: ChaveSugestao, b: ChaveSugestao, ordemMunicipio: OrdemMunicipio): number {
  return (
    maiorPrimeiro(Number(a.urgenciaConfirmada), Number(b.urgenciaConfirmada)) ||
    maiorPrimeiro(Number(a.remanejada), Number(b.remanejada)) ||
    criterios(a, b, ordemMunicipio) ||
    sinal(a.dataEntradaOriginal - b.dataEntradaOriginal) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
