/**
 * Matriz de permissões (RN-PERF-01..03, `specs/permissoes`) como dados.
 * `texto` é a linha da spec, sem alteração. Em `perfis`, a célula é `true` ("✓"),
 * `{ ressalva: "x" }` ("✓ (x)") ou `{ texto: "x" }` (texto sem ✓, como "só ao aplicar no balcão");
 * `cellText` devolve o texto exato da spec. Perfil ausente = sem permissão.
 * Perfis são acumuláveis: `pode` soma os do usuário.
 */
/**
 * Papéis de permissão (colunas da matriz). Não são cargos: vêm da ocupação da pessoa na unidade
 * (enfermeiro, técnico de enfermagem, recepção, "atendimento" para médico, dentista e eMulti) e das
 * funções de gestão (gestão SMS, regulação SMS, gerente da UBS) ou da permissão "agendar" (ver `equipe.ts`).
 */
export type Profile =
  | "patient"
  | "sms_management"
  | "sms_regulation"
  | "unit_manager"
  | "scheduler"
  | "reception"
  | "nurse"
  | "nursing_technician"
  | "care";

/** Ordem das colunas na spec. */
export const PROFILES: readonly Profile[] = [
  "patient",
  "sms_management",
  "sms_regulation",
  "unit_manager",
  "scheduler",
  "reception",
  "nurse",
  "nursing_technician",
  "care",
];

export type Action =
  | "create_units_and_rules"
  | "register_staff"
  | "view_adjustments_report"
  | "export_metrics_csv"
  | "configure_services_sessions_stations_tv"
  | "open_cancel_close_session"
  | "print_day_list"
  | "create_entry"
  | "cancel_answer_reassigned_check_in_leaving"
  | "validate_referral"
  | "allocate_confirm_refuse_for_patient"
  | "register_regulated"
  | "confirm_risk_level"
  | "add_at_desk_and_mark_attendance"
  | "verify_and_mark_attendance"
  | "reset_access"
  | "verify_or_remove_priority"
  | "give_priority"
  | "not_verified"
  | "block_hijacked_account"
  | "void_no_show"
  | "register_contingency"
  | "view_documents"
  | "view_questionnaire_answers"
  | "view_life_risk_answer"
  | "operate_calls";

export type Cell = true | { caveat: string } | { text: string };

export type MatrixRow = {
  action: Action;
  text: string;
  profiles: Partial<Record<Profile, Cell>>;
};

const ROWS: MatrixRow[] = [
  {
    action: "create_units_and_rules",
    text: "Criar unidades e regras do município",
    profiles: { sms_management: true },
  },
  {
    action: "register_staff",
    text: "Cadastrar a equipe no painel: ocupação, funções e permissões (RN-PERF-04)",
    profiles: { sms_management: true, unit_manager: { caveat: "da própria unidade, sem função de gestão" } },
  },
  {
    action: "view_adjustments_report",
    text: "Ver relatório de ajustes por usuário (RN-PERF-03)",
    profiles: { sms_management: true },
  },
  {
    action: "export_metrics_csv",
    text: "Exportar CSV das métricas do piloto (RNF-MET-01)",
    profiles: { sms_management: true },
  },
  {
    action: "configure_services_sessions_stations_tv",
    text: "Configurar serviços, sessões, estações; parear e revogar TV",
    profiles: { unit_manager: true },
  },
  {
    action: "open_cancel_close_session",
    text: "Abrir, cancelar, encerrar sessão; mudar visibilidade",
    profiles: { unit_manager: true },
  },
  {
    action: "print_day_list",
    text: "Imprimir a lista do dia, uso interno (RN-CONT-01)",
    profiles: { unit_manager: true, reception: true },
  },
  {
    action: "create_entry",
    text: "Criar entrada; escolher data quando remanejado de sessão pública",
    profiles: {
      patient: { caveat: "própria ou de quem marca" },
      scheduler: { caveat: "remarcar por quem não tem app" },
      reception: true,
    },
  },
  {
    action: "cancel_answer_reassigned_check_in_leaving",
    text: 'Cancelar; "Outra data" ou "Desistir" quando remanejado; check-in; "Vou sair"',
    profiles: { patient: { caveat: "própria ou de quem marca" } },
  },
  {
    action: "validate_referral",
    text: "Validar requisição",
    profiles: { scheduler: true },
  },
  {
    action: "allocate_confirm_refuse_for_patient",
    text: "Alocar; confirmar ou recusar em nome do paciente",
    profiles: { scheduler: true },
  },
  {
    action: "register_regulated",
    text: "Lançar paciente de serviço regulado, inclusive no dia; remover lançamento não chamado (RN-ENC-06)",
    profiles: { sms_regulation: true, scheduler: true },
  },
  {
    action: "confirm_risk_level",
    text: "Confirmar nível de risco",
    profiles: { nurse: true },
  },
  {
    action: "add_at_desk_and_mark_attendance",
    text: "Incluir paciente no balcão; marcar presença",
    profiles: { reception: true },
  },
  {
    action: "verify_and_mark_attendance",
    text: "Verificar conta; conferir pessoa atendida; validar pré-cadastro; marcar presença na mesma ação (RN-FILA-05)",
    profiles: { reception: true },
  },
  {
    action: "reset_access",
    text: "Redefinir acesso com documento conferido (RN-ID-01)",
    profiles: { reception: true },
  },
  {
    action: "verify_or_remove_priority",
    text: "Conferir ou tirar prioridade legal",
    profiles: { reception: true },
  },
  {
    action: "give_priority",
    text: "Dar prioridade legal, só na inclusão pelo balcão ou na 1ª presença de paciente sem app (RN-RISCO-04)",
    profiles: { reception: true },
  },
  {
    action: "not_verified",
    text: '"Não conferiu" (identidade não confere) (RN-FILA-05)',
    profiles: { reception: true },
  },
  {
    action: "block_hijacked_account",
    text: "Bloquear conta usurpada (RN-ID-03)",
    profiles: { reception: true },
  },
  {
    action: "void_no_show",
    text: "Anular falta por 3 pulos, com motivo (RN-FALTA-02)",
    profiles: { reception: true },
  },
  {
    action: "register_contingency",
    text: "Registrar período de contingência e atendidos na volta (RN-CONT-02)",
    profiles: { reception: true },
  },
  {
    action: "view_documents",
    text: "Ver documentos (foto do documento, Cartão SUS)",
    profiles: { patient: { caveat: "próprios" }, scheduler: true, reception: true },
  },
  {
    action: "view_questionnaire_answers",
    text: "Ver respostas do questionário",
    profiles: {
      patient: { caveat: "próprias" },
      scheduler: true,
      reception: true,
      nurse: true,
      nursing_technician: true,
    },
  },
  {
    action: "view_life_risk_answer",
    text: "Ver resposta sobre pensamentos de tirar a própria vida (RN-RISCO-06)",
    profiles: {
      patient: { caveat: "própria" },
      scheduler: true,
      reception: { text: "só ao aplicar no balcão" },
      nurse: true,
      nursing_technician: true,
    },
  },
  {
    action: "operate_calls",
    text: "Chamar, rechamar, pular, finalizar",
    profiles: {
      nurse: true,
      nursing_technician: { caveat: "acolhimento na triagem" },
      care: { caveat: "atendimento" },
    },
  },
];

export const MATRIX: ReadonlyArray<Readonly<MatrixRow>> = Object.freeze(
  ROWS.map((l) => Object.freeze({ ...l, profiles: Object.freeze({ ...l.profiles }) })),
);

/**
 * Algum dos perfis tem a ação? Qualquer célula preenchida conta (✓ ou ressalva). Para saber se a
 * concessão é livre ou depende de contexto ("própria", "só ao aplicar no balcão"), use `condicoes`.
 */
export function can(profiles: Profile[], action: Action): boolean {
  return conditions(profiles, action) !== null;
}

/**
 * "livre" se algum perfil tem ✓ simples; senão as ressalvas/textos dos perfis que têm a ação
 * (a checar por quem chama); `null` se nenhum perfil tem a ação.
 */
/**
 * PD-46: as ressalvas de `operate_calls` (texto da matriz) dizem em que etapa a pessoa opera a estação.
 * A API confere a etapa da estação por elas; o painel mostra só as estações que a pessoa pode operar.
 */
export const OPERATE_CAVEAT_STAGE: Readonly<Record<string, "triage" | "care">> = {
  "acolhimento na triagem": "triage",
  atendimento: "care",
};

export function conditions(profiles: Profile[], action: Action): "free" | string[] | null {
  const row = MATRIX.find((l) => l.action === action);
  if (row === undefined) return null;
  const restrictions: string[] = [];
  for (const p of profiles) {
    const cell = row.profiles[p];
    if (cell === undefined) continue;
    if (cell === true) return "free";
    restrictions.push("caveat" in cell ? cell.caveat : cell.text);
  }
  return restrictions.length > 0 ? restrictions : null;
}

/** Texto exato da célula na spec: "" (ausente), "✓", "✓ (ressalva)" ou o texto sem ✓. */
export function cellText(cell: Cell | undefined): string {
  if (cell === undefined) return "";
  if (cell === true) return "✓";
  return "caveat" in cell ? `✓ (${cell.caveat})` : cell.text;
}
