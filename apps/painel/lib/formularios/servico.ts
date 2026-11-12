export type Modo = "livre" | "requisicao" | "regulado";

export const ROTULOS_MODO: Record<Modo, string> = {
  livre: "Livre (paciente entra na lista)",
  requisicao: "Com requisição (validada pela unidade)",
  regulado: "Regulado (vaga vem da regulação)",
};

export function mostraTempoTriagem(exigeTriagem: boolean): boolean {
  return exigeTriagem;
}

export type ValoresServico = {
  nome: string;
  prefixo: string;
  exigeTriagem: boolean;
  modo: Modo;
  triagem: string;
  atendimento: string;
};

export function servicoParaEnvio(v: ValoresServico) {
  const tempoMedioMin: { triagem?: number; atendimento?: number } = {};
  if (v.exigeTriagem && v.triagem.trim()) tempoMedioMin.triagem = Number(v.triagem);
  if (v.atendimento.trim()) tempoMedioMin.atendimento = Number(v.atendimento);
  return {
    nome: v.nome.trim(),
    prefixo: v.prefixo.trim().toUpperCase(),
    exigeTriagem: v.exigeTriagem,
    modo: v.modo,
    tempoMedioMin,
  };
}
