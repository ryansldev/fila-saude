import { ErroDaApi } from "@/lib/api";

const MENSAGENS: Record<string, string | ((e: ErroDaApi) => string)> = {
  sem_conexao: "Sem conexão com o servidor. Tente de novo.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  sem_permissao: "Você não tem permissão para isso.",
  nao_encontrado: "Não encontrado. Recarregue a página.",
  entrada_invalida: "Confira os campos destacados.",
  ultimo_gestor: "Este é o último gestor do município: ele não pode perder o perfil.",
  login_em_uso: "Este login já está em uso.",
  prefixo_em_uso: "Este prefixo já está em uso nesta unidade.",
  sessao_aberta: "Há sessão aberta deste serviço. Espere ela encerrar.",
  servico_em_estacao_de_triagem: "Há estação de triagem ligada a este serviço. Tire o serviço dela antes.",
  servico_com_entradas: (e) =>
    `Este serviço tem ${String(e.dados?.entradasAtivas ?? "algumas")} entradas ativas. O modo só muda sem entradas.`,
  servico_regulado: "Serviço regulado não tem sessão pública.",
  estacao_ocupada: "A estação está aberta. Feche-a antes de arquivar.",
  versao_desatualizada: "A sessão mudou desde que você abriu. Recarregue a página.",
  vagas_abaixo_das_ocupadas: (e) =>
    `As vagas não podem ficar abaixo das ${String(e.dados?.ocupadas ?? "")} já ocupadas.`,
  transicao_proibida: "Não dá para fazer isso no estado atual da sessão.",
  sessao_com_pacientes: "Há pacientes nesta sessão. Ela não pode ser cancelada agora.",
};

/** Texto para a pessoa a partir de qualquer erro da chamada. */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroDaApi) {
    const m = MENSAGENS[e.erro];
    if (typeof m === "function") return m(e);
    if (m) return m;
    if (e.mensagem) return e.mensagem;
  }
  return "Não foi possível concluir. Tente de novo.";
}

export type ErrosDoEnvio = { geral: string | null; campos: Record<string, string> };

/** 400 com campos vira erro por campo; o resto, mensagem geral. */
export function errosDoEnvio(e: unknown): ErrosDoEnvio {
  if (e instanceof ErroDaApi && e.status === 400 && e.campos) {
    const campos = Object.fromEntries(Object.entries(e.campos).map(([k, v]) => [k, v[0] ?? "inválido"]));
    return { geral: null, campos };
  }
  return { geral: mensagemDoErro(e), campos: {} };
}
