import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { ErroDaApi } from "./api";

export type Situacao = { destaque: "vez" | "venha" | "normal" | "fim"; titulo: string; detalhe: string };

/** O que a tela da vez mostra para cada entrada (T3.4, RN-ETA). */
export function situacaoDaEntrada(e: MinhaEntrada): Situacao {
  if (e.itemEstado === "chamado" && e.chamada) {
    return { destaque: "vez", titulo: "É a sua vez!", detalhe: `Vá para ${e.chamada.estacao} com a senha ${e.senha}` };
  }
  if (e.estado === "concluida") return { destaque: "fim", titulo: "Atendimento concluído", detalhe: "Obrigado!" };
  if (e.estado === "remanejada")
    return {
      destaque: "fim",
      titulo: "Sua vez não chegou hoje",
      detalhe: "Você continua na lista e vai receber outra data.",
    };
  if (e.estado === "encerrada_sem_atendimento" || e.itemEstado === "saiu_da_fila")
    return { destaque: "fim", titulo: "Você saiu da fila", detalhe: "Procure a recepção se precisar." };
  if (e.estado === "cancelada") return { destaque: "fim", titulo: "Inscrição cancelada", detalhe: "" };
  if (e.estado === "na_reserva")
    return { destaque: "normal", titulo: "Você está na reserva", detalhe: "Se abrir uma vaga, ela é sua." };
  if (e.estado === "confirmada")
    return {
      destaque: "normal",
      titulo: "Inscrição confirmada",
      detalhe: "Quando a sessão abrir, você recebe sua senha e a posição na fila.",
    };
  const est = e.estimativa;
  if (est?.tipo === "venha_agora")
    return { destaque: "venha", titulo: "Venha agora", detalhe: "Você é o próximo. Vá para a unidade." };
  if (est?.tipo === "posicao") {
    const titulo = `Você é o ${est.posicao}º da fila`;
    const presente = e.itemEstado === "presente" ? " · você está na unidade" : "";
    return { destaque: "normal", titulo, detalhe: `Cerca de ${est.minutos} min${presente}` };
  }
  if (est?.tipo === "aguardando_inicio")
    return { destaque: "normal", titulo: "Aguardando o início", detalhe: "A fila ainda não começou a andar." };
  if (e.itemEstado === "atendido_na_etapa") return { destaque: "fim", titulo: "Atendimento concluído", detalhe: "" };
  return { destaque: "normal", titulo: "Na fila", detalhe: "" };
}

const MENSAGENS: Record<string, string> = {
  sem_conexao: "Sem conexão com o servidor. Confira a internet e tente de novo.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  credenciais: "CPF ou senha incorretos.",
  duplicada: "Essa pessoa já está inscrita para este atendimento.",
  emergencia: "Pelo que você marcou, procure atendimento de emergência agora: ligue 192.",
  sessao_privada: "Esta agenda é só pela lista de espera da unidade.",
  sessao_fechada: "Esta sessão já foi encerrada.",
  servico_regulado: "Este atendimento é marcado pela central de regulação.",
  requisicao_pendente: "Este atendimento pede requisição médica.",
  cpf_invalido: "CPF inválido.",
  entrada_invalida: "Confira os dados preenchidos.",
};

export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroDaApi) return e.mensagem ?? MENSAGENS[e.erro] ?? "Não foi possível concluir. Tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
}
