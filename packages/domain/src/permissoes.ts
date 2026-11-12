/**
 * Matriz de permissões (RN-PERF-01..03, `specs/permissoes`) como dados.
 * `texto` é a linha da spec, sem alteração. Em `perfis`, a célula é `true` ("✓"),
 * `{ ressalva: "x" }` ("✓ (x)") ou `{ texto: "x" }` (texto sem ✓, como "só ao aplicar no balcão");
 * `textoDaCelula` devolve o texto exato da spec. Perfil ausente = sem permissão.
 * Perfis são acumuláveis: `pode` soma os do usuário.
 */
/**
 * Papéis de permissão (colunas da matriz). Não são cargos: vêm da ocupação da pessoa na unidade
 * (enfermeiro, técnico de enfermagem, recepção, "atendimento" para médico, dentista e eMulti) e das
 * funções de gestão (gestão SMS, regulação SMS, gerente da UBS) ou da permissão "agendar" (ver `equipe.ts`).
 */
export type Perfil =
  | "paciente"
  | "gestao_sms"
  | "regulacao_sms"
  | "gerente_ubs"
  | "agendar"
  | "recepcao"
  | "enfermeiro"
  | "tecnico_enfermagem"
  | "atendimento";

/** Ordem das colunas na spec. */
export const PERFIS: readonly Perfil[] = [
  "paciente",
  "gestao_sms",
  "regulacao_sms",
  "gerente_ubs",
  "agendar",
  "recepcao",
  "enfermeiro",
  "tecnico_enfermagem",
  "atendimento",
];

export type Acao =
  | "criar_unidades_e_regras"
  | "cadastrar_equipe"
  | "ver_relatorio_de_ajustes"
  | "exportar_csv_metricas"
  | "configurar_servicos_sessoes_estacoes_tv"
  | "abrir_cancelar_encerrar_sessao"
  | "imprimir_lista_do_dia"
  | "criar_entrada"
  | "cancelar_responder_remanejado_check_in_vou_sair"
  | "validar_requisicao"
  | "alocar_confirmar_recusar_pelo_paciente"
  | "lancar_regulado"
  | "confirmar_nivel_de_risco"
  | "incluir_no_balcao_e_marcar_presenca"
  | "conferir_e_marcar_presenca"
  | "redefinir_acesso"
  | "conferir_ou_tirar_prioridade"
  | "dar_prioridade"
  | "nao_conferiu"
  | "bloquear_conta_usurpada"
  | "anular_falta"
  | "registrar_contingencia"
  | "ver_documentos"
  | "ver_respostas_do_questionario"
  | "ver_resposta_risco_de_vida"
  | "operar_chamadas";

export type Celula = true | { ressalva: string } | { texto: string };

export type LinhaMatriz = {
  acao: Acao;
  texto: string;
  perfis: Partial<Record<Perfil, Celula>>;
};

const LINHAS: LinhaMatriz[] = [
  {
    acao: "criar_unidades_e_regras",
    texto: "Criar unidades e regras do município",
    perfis: { gestao_sms: true },
  },
  {
    acao: "cadastrar_equipe",
    texto: "Cadastrar a equipe no painel: ocupação, funções e permissões (RN-PERF-04)",
    perfis: { gestao_sms: true, gerente_ubs: { ressalva: "da própria unidade, sem função de gestão" } },
  },
  {
    acao: "ver_relatorio_de_ajustes",
    texto: "Ver relatório de ajustes por usuário (RN-PERF-03)",
    perfis: { gestao_sms: true },
  },
  {
    acao: "exportar_csv_metricas",
    texto: "Exportar CSV das métricas do piloto (RNF-MET-01)",
    perfis: { gestao_sms: true },
  },
  {
    acao: "configurar_servicos_sessoes_estacoes_tv",
    texto: "Configurar serviços, sessões, estações; parear e revogar TV",
    perfis: { gerente_ubs: true },
  },
  {
    acao: "abrir_cancelar_encerrar_sessao",
    texto: "Abrir, cancelar, encerrar sessão; mudar visibilidade",
    perfis: { gerente_ubs: true },
  },
  {
    acao: "imprimir_lista_do_dia",
    texto: "Imprimir a lista do dia, uso interno (RN-CONT-01)",
    perfis: { gerente_ubs: true, recepcao: true },
  },
  {
    acao: "criar_entrada",
    texto: "Criar entrada; escolher data quando remanejado de sessão pública",
    perfis: {
      paciente: { ressalva: "própria ou de quem marca" },
      agendar: { ressalva: "remarcar por quem não tem app" },
      recepcao: true,
    },
  },
  {
    acao: "cancelar_responder_remanejado_check_in_vou_sair",
    texto: 'Cancelar; "Outra data" ou "Desistir" quando remanejado; check-in; "Vou sair"',
    perfis: { paciente: { ressalva: "própria ou de quem marca" } },
  },
  {
    acao: "validar_requisicao",
    texto: "Validar requisição",
    perfis: { agendar: true },
  },
  {
    acao: "alocar_confirmar_recusar_pelo_paciente",
    texto: "Alocar; confirmar ou recusar em nome do paciente",
    perfis: { agendar: true },
  },
  {
    acao: "lancar_regulado",
    texto: "Lançar paciente de serviço regulado, inclusive no dia; remover lançamento não chamado (RN-ENC-06)",
    perfis: { regulacao_sms: true, agendar: true },
  },
  {
    acao: "confirmar_nivel_de_risco",
    texto: "Confirmar nível de risco",
    perfis: { enfermeiro: true },
  },
  {
    acao: "incluir_no_balcao_e_marcar_presenca",
    texto: "Incluir paciente no balcão; marcar presença",
    perfis: { recepcao: true },
  },
  {
    acao: "conferir_e_marcar_presenca",
    texto:
      "Verificar conta; conferir pessoa atendida; validar pré-cadastro; marcar presença na mesma ação (RN-FILA-05)",
    perfis: { recepcao: true },
  },
  {
    acao: "redefinir_acesso",
    texto: "Redefinir acesso com documento conferido (RN-ID-01)",
    perfis: { recepcao: true },
  },
  {
    acao: "conferir_ou_tirar_prioridade",
    texto: "Conferir ou tirar prioridade legal",
    perfis: { recepcao: true },
  },
  {
    acao: "dar_prioridade",
    texto: "Dar prioridade legal, só na inclusão pelo balcão ou na 1ª presença de paciente sem app (RN-RISCO-04)",
    perfis: { recepcao: true },
  },
  {
    acao: "nao_conferiu",
    texto: '"Não conferiu" (identidade não confere) (RN-FILA-05)',
    perfis: { recepcao: true },
  },
  {
    acao: "bloquear_conta_usurpada",
    texto: "Bloquear conta usurpada (RN-ID-03)",
    perfis: { recepcao: true },
  },
  {
    acao: "anular_falta",
    texto: "Anular falta por 3 pulos, com motivo (RN-FALTA-02)",
    perfis: { recepcao: true },
  },
  {
    acao: "registrar_contingencia",
    texto: "Registrar período de contingência e atendidos na volta (RN-CONT-02)",
    perfis: { recepcao: true },
  },
  {
    acao: "ver_documentos",
    texto: "Ver documentos (foto do documento, Cartão SUS)",
    perfis: { paciente: { ressalva: "próprios" }, agendar: true, recepcao: true },
  },
  {
    acao: "ver_respostas_do_questionario",
    texto: "Ver respostas do questionário",
    perfis: {
      paciente: { ressalva: "próprias" },
      agendar: true,
      recepcao: true,
      enfermeiro: true,
      tecnico_enfermagem: true,
    },
  },
  {
    acao: "ver_resposta_risco_de_vida",
    texto: "Ver resposta sobre pensamentos de tirar a própria vida (RN-RISCO-06)",
    perfis: {
      paciente: { ressalva: "própria" },
      agendar: true,
      recepcao: { texto: "só ao aplicar no balcão" },
      enfermeiro: true,
      tecnico_enfermagem: true,
    },
  },
  {
    acao: "operar_chamadas",
    texto: "Chamar, rechamar, pular, finalizar",
    perfis: {
      enfermeiro: true,
      tecnico_enfermagem: { ressalva: "acolhimento na triagem" },
      atendimento: { ressalva: "atendimento" },
    },
  },
];

export const MATRIZ: ReadonlyArray<Readonly<LinhaMatriz>> = Object.freeze(
  LINHAS.map((l) => Object.freeze({ ...l, perfis: Object.freeze({ ...l.perfis }) })),
);

/**
 * Algum dos perfis tem a ação? Qualquer célula preenchida conta (✓ ou ressalva). Para saber se a
 * concessão é livre ou depende de contexto ("própria", "só ao aplicar no balcão"), use `condicoes`.
 */
export function pode(perfis: Perfil[], acao: Acao): boolean {
  return condicoes(perfis, acao) !== null;
}

/**
 * "livre" se algum perfil tem ✓ simples; senão as ressalvas/textos dos perfis que têm a ação
 * (a checar por quem chama); `null` se nenhum perfil tem a ação.
 */
export function condicoes(perfis: Perfil[], acao: Acao): "livre" | string[] | null {
  const linha = MATRIZ.find((l) => l.acao === acao);
  if (linha === undefined) return null;
  const restricoes: string[] = [];
  for (const p of perfis) {
    const celula = linha.perfis[p];
    if (celula === undefined) continue;
    if (celula === true) return "livre";
    restricoes.push("ressalva" in celula ? celula.ressalva : celula.texto);
  }
  return restricoes.length > 0 ? restricoes : null;
}

/** Texto exato da célula na spec: "" (ausente), "✓", "✓ (ressalva)" ou o texto sem ✓. */
export function textoDaCelula(celula: Celula | undefined): string {
  if (celula === undefined) return "";
  if (celula === true) return "✓";
  return "ressalva" in celula ? `✓ (${celula.ressalva})` : celula.texto;
}
