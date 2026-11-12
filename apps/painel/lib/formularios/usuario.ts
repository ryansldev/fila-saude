import {
  type Atribuicoes,
  FUNCOES,
  type Funcao,
  OCUPACOES,
  type Ocupacao,
  podeCadastrar,
  problemasDaEquipe,
} from "@fila-saude/domain";

export type { Atribuicoes, Funcao, Ocupacao };
export { FUNCOES, OCUPACOES };

const TODAS_AS_FUNCOES = Object.keys(FUNCOES) as Funcao[];
export const TODAS_AS_OCUPACOES = Object.keys(OCUPACOES) as Ocupacao[];

const ehSms = (a: Atribuicoes) => a.funcoes.some((f) => f.funcao === "gestao_sms");
const gerencia = (a: Atribuicoes) =>
  new Set(a.funcoes.filter((f) => f.funcao === "gerente_ubs").map((f) => f.unidadeId));

/** RN-PERF-04: SMS concede qualquer função; o gerente, só "agendar"; os outros, nada. */
export function funcoesQuePodeConceder(ator: Atribuicoes): Funcao[] {
  if (ehSms(ator)) return TODAS_AS_FUNCOES;
  return gerencia(ator).size > 0 ? ["agendar"] : [];
}

/** SMS atribui em qualquer unidade; o gerente, só nas que ele gerencia. */
export function unidadesQuePodeAtribuir<U extends { id: string }>(ator: Atribuicoes, unidades: U[]): U[] {
  if (ehSms(ator)) return unidades;
  const minhas = gerencia(ator);
  return unidades.filter((u) => minhas.has(u.id));
}

/** Problemas de forma (escopo) e de permissão, antes de enviar. */
export function problemasDoCadastro(ator: Atribuicoes, alvo: Atribuicoes): Record<string, string> {
  const forma = problemasDaEquipe(alvo);
  if (Object.keys(forma).length > 0) return forma;
  if (!podeCadastrar(ator, alvo)) return { _: "Você só cadastra a equipe da sua unidade, sem função de gestão." };
  return {};
}

/** Resumo legível: "Enfermeiro(a) · UBS Centro; Gerente da UBS · UBS Centro". */
export function resumoDasAtribuicoes(a: Atribuicoes, nomeDaUnidade: (id: string | null) => string): string {
  return [
    ...a.vinculos.map((v) => `${OCUPACOES[v.ocupacao].rotulo} · ${nomeDaUnidade(v.unidadeId)}`),
    ...a.funcoes.map((f) => `${FUNCOES[f.funcao].rotulo}${f.unidadeId ? ` · ${nomeDaUnidade(f.unidadeId)}` : ""}`),
  ].join("; ");
}
