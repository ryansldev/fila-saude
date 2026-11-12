// Quem é quem na unidade (discovery-papeis-ubs, RN-PERF-04). A ocupação é o que a pessoa é (alinhada ao
// CBO do vínculo no CNES); a função de gestão é o que ela administra; "agendar" é uma permissão ligável.
// As permissões saem daqui para os papéis da matriz (`permissoes.ts`).

import type { Perfil } from "./permissoes.ts";

export type Ocupacao =
  | "medico"
  | "enfermeiro"
  | "tecnico_enfermagem"
  | "cirurgiao_dentista"
  | "auxiliar_saude_bucal"
  | "acs"
  | "recepcao"
  | "farmaceutico"
  | "psicologo"
  | "fisioterapeuta"
  | "nutricionista"
  | "assistente_social";

export type Funcao = "gestao_sms" | "regulacao_sms" | "gerente_ubs" | "agendar";

export type Vinculo = { unidadeId: string; ocupacao: Ocupacao };
export type FuncaoComEscopo = { funcao: Funcao; unidadeId: string | null };
export type Atribuicoes = { vinculos: Vinculo[]; funcoes: FuncaoComEscopo[] };
export type PapelComEscopo = { perfil: Perfil; unidadeId: string | null };

const ATENDIMENTO: Perfil[] = ["atendimento"];

export const OCUPACOES: Readonly<Record<Ocupacao, { rotulo: string; papeis: readonly Perfil[] }>> = Object.freeze({
  medico: { rotulo: "Médico(a)", papeis: ATENDIMENTO },
  enfermeiro: { rotulo: "Enfermeiro(a)", papeis: ["enfermeiro"] },
  tecnico_enfermagem: { rotulo: "Técnico(a) ou auxiliar de enfermagem", papeis: ["tecnico_enfermagem"] },
  cirurgiao_dentista: { rotulo: "Cirurgião(ã)-dentista", papeis: ATENDIMENTO },
  auxiliar_saude_bucal: { rotulo: "Técnico(a) ou auxiliar em saúde bucal", papeis: [] },
  acs: { rotulo: "Agente comunitário de saúde", papeis: [] },
  recepcao: { rotulo: "Recepção / auxiliar administrativo", papeis: ["recepcao"] },
  farmaceutico: { rotulo: "Farmacêutico(a)", papeis: ATENDIMENTO },
  psicologo: { rotulo: "Psicólogo(a)", papeis: ATENDIMENTO },
  fisioterapeuta: { rotulo: "Fisioterapeuta", papeis: ATENDIMENTO },
  nutricionista: { rotulo: "Nutricionista", papeis: ATENDIMENTO },
  assistente_social: { rotulo: "Assistente social", papeis: ATENDIMENTO },
});

export const FUNCOES: Readonly<Record<Funcao, { rotulo: string; escopo: "municipio" | "unidade"; gestao: boolean }>> =
  Object.freeze({
    gestao_sms: { rotulo: "Gestão municipal (SMS)", escopo: "municipio", gestao: true },
    regulacao_sms: { rotulo: "Regulação (SMS)", escopo: "municipio", gestao: true },
    gerente_ubs: { rotulo: "Gerente da UBS", escopo: "unidade", gestao: true },
    agendar: { rotulo: "Agendar pacientes da lista de espera", escopo: "unidade", gestao: false },
  });

/** Papéis de permissão de quem tem estas atribuições, cada um com o seu escopo. */
export function papeisDe(a: Atribuicoes): PapelComEscopo[] {
  return [
    ...a.vinculos.flatMap((v) => OCUPACOES[v.ocupacao].papeis.map((perfil) => ({ perfil, unidadeId: v.unidadeId }))),
    ...a.funcoes.map((f) => ({ perfil: f.funcao as Perfil, unidadeId: f.unidadeId })),
  ];
}

/** Erros de forma: ao menos uma atribuição; função do município sem unidade, da unidade com unidade. */
export function problemasDaEquipe(a: Atribuicoes): Record<string, string> {
  if (a.vinculos.length === 0 && a.funcoes.length === 0) return { _: "Informe ao menos uma ocupação ou função." };
  const erros: Record<string, string> = {};
  a.funcoes.forEach((f, i) => {
    const doMunicipio = FUNCOES[f.funcao].escopo === "municipio";
    if (doMunicipio && f.unidadeId !== null) erros[`funcoes.${i}.unidadeId`] = "Função do município, sem unidade.";
    if (!doMunicipio && f.unidadeId === null) erros[`funcoes.${i}.unidadeId`] = "Escolha a unidade.";
  });
  return erros;
}

/**
 * RN-PERF-04: quem cadastra quem. A gestão SMS cadastra qualquer pessoa. O gerente da UBS cadastra só quem
 * fica inteiramente nas unidades que ele gerencia e só concede "agendar" (nenhuma função de gestão).
 * Os outros não cadastram ninguém.
 */
export function podeCadastrar(ator: Atribuicoes, alvo: Atribuicoes): boolean {
  if (ator.funcoes.some((f) => f.funcao === "gestao_sms")) return true;
  const gerencia = new Set(ator.funcoes.filter((f) => f.funcao === "gerente_ubs").map((f) => f.unidadeId));
  if (gerencia.size === 0) return false;
  return (
    alvo.vinculos.every((v) => gerencia.has(v.unidadeId)) &&
    alvo.funcoes.every((f) => !FUNCOES[f.funcao].gestao && gerencia.has(f.unidadeId))
  );
}
