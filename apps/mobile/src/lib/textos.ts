import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { ErroDaApi } from "./api";

/** Estado de uma entrada na tela "minha fila", na mesma divisão das telas do design do app. */
export type Situacao =
  | { tipo: "vez"; senha: string; estacao: string }
  | { tipo: "recepcao" }
  | { tipo: "venha" }
  | { tipo: "posicao"; posicao: number; minutos: number; presente: boolean }
  | { tipo: "aguardando" }
  | { tipo: "confirmada" }
  | { tipo: "reserva" }
  | { tipo: "lista" }
  | { tipo: "concluida" }
  | { tipo: "remanejada" }
  | { tipo: "saiu" }
  | { tipo: "cancelada" };

/** T3.4 / RN-ETA / RN-FILA-05: o que a tela mostra para cada entrada. */
export function situacaoDaEntrada(e: MinhaEntrada): Situacao {
  if (e.itemEstado === "chamado" && e.chamada && e.senha) {
    return { tipo: "vez", senha: e.senha, estacao: e.chamada.estacao };
  }
  if (e.estado === "concluida" || e.itemEstado === "atendido_na_etapa") return { tipo: "concluida" };
  if (e.estado === "remanejada") return { tipo: "remanejada" };
  if (e.estado === "encerrada_sem_atendimento" || e.itemEstado === "saiu_da_fila") return { tipo: "saiu" };
  if (e.estado === "cancelada") return { tipo: "cancelada" };
  if (e.estado === "na_reserva") return { tipo: "reserva" };
  if (e.estado === "confirmada") return { tipo: "confirmada" };
  if (e.estado === "aguardando" || e.estado === "alocada") return { tipo: "lista" };
  if (e.itemEstado === "remoto" && e.pendencias.length > 0) return { tipo: "recepcao" };
  const est = e.estimativa;
  if (est?.tipo === "venha_agora") return { tipo: "venha" };
  if (est?.tipo === "posicao") {
    return { tipo: "posicao", posicao: est.posicao, minutos: est.minutos, presente: e.itemEstado === "presente" };
  }
  return { tipo: "aguardando" };
}

const MENSAGENS: Record<string, string> = {
  sem_conexao: "sem internet. confira a conexão e tente de novo.",
  nao_autenticado: "sua sessão expirou. entre de novo.",
  credenciais: "CPF ou senha incorretos.",
  duplicada: "essa pessoa já está inscrita neste atendimento.",
  emergencia: "isso pode ser uma emergência. ligue 192.",
  sessao_privada: "este atendimento é só por agendamento da unidade.",
  sessao_fechada: "este atendimento já foi encerrado.",
  servico_regulado: "este atendimento é marcado pela regulação.",
  requisicao_pendente: "este atendimento pede requisição médica.",
  cpf_invalido: "CPF inválido.",
  entrada_invalida: "confira os dados preenchidos.",
  qr_invalido: "QR vencido. leia de novo o QR da unidade.",
};

export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroDaApi) return e.mensagem ?? MENSAGENS[e.erro] ?? "não deu certo. tente de novo.";
  return "não deu certo. tente de novo.";
}
