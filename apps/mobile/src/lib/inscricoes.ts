import type { MinhaEntrada } from "@fila-saude/schemas/fila";

/** Estados em que a entrada terminou: deixam a pessoa livre para se inscrever de novo no serviço. */
const FINAIS = new Set(["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada", "remanejada"]);

export const entradaAtiva = (e: Pick<MinhaEntrada, "estado">) => !FINAIS.has(e.estado);

/** AD-032: o dono da conta já tem uma entrada ativa neste serviço (então "para mim" não pode de novo). */
export function paraMimNoServico(minhas: MinhaEntrada[] | null, servicoId: string | undefined): boolean {
  if (!minhas || !servicoId) return false;
  return minhas.some((e) => e.paraMim && e.servicoId === servicoId && entradaAtiva(e));
}

export type InscricaoNaAgenda = { tipo: "livre" } | { tipo: "inscrito"; nestaData: boolean };

/**
 * Como a agenda mostra a sessão para a conta: "inscrito" quando o dono já está no serviço (nesta data
 * ou noutra). Só outras pessoas da conta inscritas não bloqueiam: o dono ainda pode se inscrever.
 * Sem "minhas" (carregando ou falhou), fica livre: a API ainda recusa a duplicada.
 */
export function inscricaoNaAgenda(
  sessao: { id: string; servico: { id: string } },
  minhas: MinhaEntrada[] | null,
): InscricaoNaAgenda {
  const minha = (minhas ?? []).filter((e) => e.paraMim && e.servicoId === sessao.servico.id && entradaAtiva(e));
  if (minha.length === 0) return { tipo: "livre" };
  return { tipo: "inscrito", nestaData: minha.some((e) => e.sessao?.id === sessao.id) };
}

const normalizar = (nome: string) =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mesmo nome, sem ligar para maiúsculas, acentos e espaços a mais. */
export function mesmaPessoa(a: string, b: string): boolean {
  const na = normalizar(a);
  return na !== "" && na === normalizar(b);
}

/** A conta já inscreveu esta "outra pessoa" (pelo nome) no serviço: evita mandar a mesma pessoa duas vezes. */
export function outraPessoaJaInscrita(minhas: MinhaEntrada[] | null, servicoId: string | undefined, nome: string) {
  if (!minhas || !servicoId) return false;
  return minhas.some((e) => !e.paraMim && e.servicoId === servicoId && entradaAtiva(e) && mesmaPessoa(e.pessoa, nome));
}
