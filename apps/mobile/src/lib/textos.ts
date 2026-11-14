import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { ErroDaApi } from "./api";
import { ehHoje } from "./datas";

/** Estado de uma entrada na tela "minha fila", na mesma divisão das telas do design do app. */
export type Situacao =
  | { tipo: "vez"; senha: string; estacao: string | null }
  | { tipo: "recepcao" }
  | { tipo: "venha" }
  | { tipo: "posicao"; posicao: number; minutos: number; presente: boolean; sair: boolean }
  /** Sessão ainda planejada e antes do horário. */
  | { tipo: "aguardando" }
  /** Fila aberta, mas sem previsão (nenhuma estação aberta, modo manual, fora da ordem): nunca "vai começar". */
  | { tipo: "sem_previsao"; presente: boolean }
  | { tipo: "confirmada" }
  /** Passou do horário de início e a unidade ainda não abriu a fila (abertura por botão na v0.1). */
  | { tipo: "atrasada" }
  | { tipo: "alocada" }
  | { tipo: "reserva" }
  | { tipo: "lista" }
  | { tipo: "concluida" }
  | { tipo: "remanejada" }
  | { tipo: "saiu" }
  | { tipo: "cancelada" };

/** T3.4 / RN-ETA / RN-FILA-05: o que a tela mostra para cada entrada, olhando o estado e o relógio. */
export function situacaoDaEntrada(e: MinhaEntrada, agora: number): Situacao {
  // Fim da entrada primeiro: cancelada ou arquivada nunca é "não compareceu".
  if (e.estado === "cancelada" || e.estado === "arquivada") return { tipo: "cancelada" };
  if (e.itemEstado === "chamado" && e.senha) {
    return { tipo: "vez", senha: e.senha, estacao: e.chamada?.estacao ?? null };
  }
  if (e.estado === "concluida" || e.itemEstado === "atendido_na_etapa") return { tipo: "concluida" };
  if (e.estado === "remanejada") return { tipo: "remanejada" };
  if (e.estado === "encerrada_sem_atendimento" || e.itemEstado === "saiu_da_fila") return { tipo: "saiu" };
  if (e.estado === "na_reserva") return { tipo: "reserva" };
  const antesDoInicio = !e.sessao || agora < Date.parse(e.sessao.inicio);
  if (e.estado === "confirmada") {
    if (e.sessao?.estado === "planejada" && !antesDoInicio) return { tipo: "atrasada" };
    return { tipo: "confirmada" };
  }
  if (e.estado === "alocada" && e.sessao) return { tipo: "alocada" };
  if (e.estado === "aguardando" || e.estado === "alocada" || e.estado === "aguardando_encaminhamento")
    return { tipo: "lista" };
  if (e.itemEstado === "remoto" && e.pendencias.length > 0) return { tipo: "recepcao" };
  const est = e.estimativa;
  if (est?.tipo === "venha_agora") return { tipo: "venha" };
  if (est?.tipo === "posicao") {
    const presente = e.itemEstado === "presente";
    return { tipo: "posicao", posicao: est.posicao, minutos: est.minutos, presente, sair: !presente && e.saiaDeCasa };
  }
  if (e.sessao?.estado === "planejada") return antesDoInicio ? { tipo: "aguardando" } : { tipo: "atrasada" };
  return { tipo: "sem_previsao", presente: e.itemEstado === "presente" };
}

const MENSAGENS: Record<string, string> = {
  sem_conexao: "sem internet. confira a conexão e tente de novo.",
  nao_autenticado: "sua sessão expirou. entre de novo.",
  sem_permissao: "o servidor recusou o pedido. feche o app, abra de novo e tente outra vez.",
  muitas_tentativas: "muitas tentativas seguidas. espere um minuto e tente de novo.",
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

/** Faixa de erro de uma tela: "sem internet" só quando a rede falhou; o resto diz o motivo. */
export function avisoDoErro(
  e: unknown,
  semInternet = "a sua posição volta a aparecer quando a conexão voltar.",
): { titulo: string; texto: string } {
  if (e instanceof ErroDaApi && e.erro === "sem_conexao") return { titulo: "sem internet", texto: semInternet };
  return { titulo: "não deu para atualizar", texto: mensagemDoErro(e) };
}

export type Tom = "azul" | "verde" | "amarelo" | "cinza" | "vermelho";

/**
 * O que a "minha fila" mostra no topo de cada atendimento, para não haver dúvida:
 * - `naFila`: já tem senha na fila do dia (em casa ou na unidade). Lista de espera, reserva e
 *   inscrição para outro dia ainda NÃO são fila.
 * - `etapa`: posição na trilha inscrição (0) → fila (1) → unidade (2) → sala (3) → atendido (4);
 *   `null` quando terminou sem atendimento (cancelado, saiu, remanejado).
 * - `grupo`: seção da tela (hoje, próximos, sem data, encerrados).
 */
export function resumoDaEntrada(
  en: MinhaEntrada,
  sit: Situacao,
  agora: number,
): {
  selo: string;
  tom: Tom;
  naFila: boolean;
  etapa: number | null;
  grupo: "hoje" | "proximos" | "sem_data" | "encerrados";
} {
  const base = (() => {
    switch (sit.tipo) {
      case "lista":
        return { selo: "na lista de espera", tom: "cinza" as Tom, naFila: false, etapa: 0 };
      case "reserva":
        return { selo: "na reserva", tom: "amarelo" as Tom, naFila: false, etapa: 0 };
      case "alocada":
        return { selo: "data marcada", tom: "azul" as Tom, naFila: false, etapa: 0 };
      case "confirmada":
      case "aguardando":
      case "atrasada":
        return { selo: "inscrito", tom: "azul" as Tom, naFila: false, etapa: 1 };
      case "recepcao":
        return { selo: "passe na recepção", tom: "amarelo" as Tom, naFila: true, etapa: 1 };
      case "venha":
        return { selo: "venha agora", tom: "amarelo" as Tom, naFila: true, etapa: 1 };
      case "posicao":
        if (sit.presente) return { selo: "na fila · na unidade", tom: "verde" as Tom, naFila: true, etapa: 2 };
        if (sit.sair) return { selo: "hora de sair de casa", tom: "amarelo" as Tom, naFila: true, etapa: 1 };
        return { selo: "na fila · em casa", tom: "azul" as Tom, naFila: true, etapa: 1 };
      case "sem_previsao":
        return sit.presente
          ? { selo: "na fila · na unidade", tom: "verde" as Tom, naFila: true, etapa: 2 }
          : { selo: "na fila · em casa", tom: "azul" as Tom, naFila: true, etapa: 1 };
      case "vez":
        return { selo: "é a sua vez", tom: "verde" as Tom, naFila: true, etapa: 3 };
      case "concluida":
        return { selo: "atendido", tom: "verde" as Tom, naFila: false, etapa: 4 };
      case "remanejada":
        return { selo: "não foi atendido hoje", tom: "cinza" as Tom, naFila: false, etapa: null };
      case "saiu":
        return { selo: "saiu da fila", tom: "vermelho" as Tom, naFila: false, etapa: null };
      case "cancelada":
        return { selo: "cancelado", tom: "cinza" as Tom, naFila: false, etapa: null };
    }
  })();
  const terminou = ["concluida", "remanejada", "saiu", "cancelada"].includes(sit.tipo);
  const grupo = terminou
    ? "encerrados"
    : !en.sessao
      ? "sem_data"
      : base.naFila || ehHoje(en.sessao.inicio, agora)
        ? "hoje"
        : "proximos";
  return { ...base, grupo };
}
