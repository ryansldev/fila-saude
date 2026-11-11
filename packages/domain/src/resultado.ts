export type CodigoErro =
  | "transicao_proibida"
  | "sem_vaga"
  | "duplicada"
  | "emergencia"
  | "servico_regulado"
  | "sessao_fechada"
  | "nenhum_elegivel"
  | "estacao_ocupada"
  | "estacao_com_chamado"
  | "qr_invalido"
  | "requisicao_pendente"
  | "sem_permissao"
  | "fora_do_prazo"
  | "pendencia";

export type TipoEvento =
  | "entrada_criada"
  | "alocada"
  | "confirmada"
  | "recusada"
  | "vaga_liberada"
  | "inscrita"
  | "na_reserva"
  | "lancada"
  | "removida"
  | "senha_emitida"
  | "presente"
  | "pendencia"
  | "pendencia_resolvida"
  | "nao_conferiu"
  | "prioridade_retirada"
  | "saiu"
  | "chamado"
  | "rechamado"
  | "atendido"
  | "pulado"
  | "saiu_da_fila"
  | "falta"
  | "falta_apagada"
  | "remanejado"
  | "saia_de_casa"
  | "venha_agora"
  | "alerta_agendador"
  | "lista_ligacao"
  | "arquivada"
  | "ainda_precisa"
  | "reativada"
  | "cancelada";

export type Evento = {
  tipo: TipoEvento;
  entradaId?: string;
  itemId?: string;
  estacaoId?: string;
  sessaoId?: string;
  motivo?: string;
  dados?: Record<string, unknown>;
};

export type Resultado<E> = { ok: true; estado: E; eventos: Evento[] } | { ok: false; erro: CodigoErro };

export function ok<E>(estado: E, eventos: Evento[] = []): Resultado<E> {
  return { ok: true, estado, eventos };
}

export function falha(erro: CodigoErro): { ok: false; erro: CodigoErro } {
  return { ok: false, erro };
}
