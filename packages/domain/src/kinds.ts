import type { Group } from "./priority.ts";

/**
 * Nível de risco. O questionário sugere quatro (Manchester reduzido, sem "muito_urgente"); a
 * triagem confirma pelas cinco cores do Manchester (AD-058): vermelho emergência, laranja muito
 * urgente, amarelo urgente, verde atenção (pouco urgente), azul rotina (não urgente).
 */
export type RiskLevel = "emergency" | "very_urgent" | "urgent" | "attention" | "routine";

/** Tempo-alvo de espera por cor (Manchester, AD-058), em minutos. */
export const TARGET_TIME_MIN: Record<RiskLevel, number> = {
  emergency: 0,
  very_urgent: 10,
  urgent: 60,
  attention: 120,
  routine: 240,
};

/** Urgência confirmada (RN-ORD: sempre primeiro): vermelho, laranja ou amarelo dados pela triagem. */
export const isUrgent = (level: RiskLevel | null): boolean =>
  level === "urgent" || level === "very_urgent" || level === "emergency";

/**
 * Tela 1 do questionário v1. "Nenhum destes" não entra aqui: é a lista vazia.
 * - falta_de_ar: falta de ar forte ou dificuldade para respirar
 * - dor_no_peito: dor ou aperto forte no peito
 * - desmaio: desmaio, confusão ou sonolência estranha
 * - fraqueza_de_um_lado: fraqueza, formigamento ou boca torta de repente
 * - sangramento: sangramento que não para
 * - convulsao: convulsão
 * - autolesao: pensamentos de tirar a própria vida ou de se machucar
 */
export type Alarm =
  | "shortness_of_breath"
  | "chest_pain"
  | "fainting"
  | "one_sided_weakness"
  | "bleeding"
  | "seizure"
  | "self_harm";

/** Tela 2: novo (problema novo ou que piorou), acompanhamento, exame (check-up ou rotina), receita. */
export type Reason = "new" | "follow_up" | "exam" | "prescription";

/** Tela 3, só para motivo "novo". */
export type Severity = "mild" | "moderate" | "severe";

/**
 * Tela 4. "Nenhuma" é a lista vazia.
 * - respiratoria: asma, bronquite ou DPOC
 * - coracao: doença do coração
 * - cancer: câncer em tratamento
 * - imunidade_baixa: transplante, HIV, uso de corticoide
 */
export type Condition = "diabetes" | "high_blood_pressure" | "heart" | "respiratory" | "cancer" | "low_immunity";

/** Tela 5 (prioridade legal, RN-RISCO-04). "Nenhuma" é a lista vazia. */
export type DeclaredGroup =
  | "pregnant"
  | "breastfeeding"
  | "infant_in_arms"
  | "disability"
  | "autism"
  | "reduced_mobility"
  | "blood_donor"
  | "obesity";

export type Answers = {
  alarms: Alarm[];
  reason: Reason;
  severity: Severity | null;
  conditions: Condition[];
  groups: DeclaredGroup[];
};

export type Classification = {
  level: RiskLevel;
  /** Regra que bateu, em texto para a ficha do agendador (RN-RISCO-05). */
  rule: string;
  /** Mostrar CVV (188) e SAMU (192) em destaque. */
  support: boolean;
};

/** Ordem entre risco e prioridade legal (configuração do município, RN-ORD). */
export type MunicipalityOrder = "risk" | "priority";

/** Configurações que a fila do dia usa (§ Configurações de specs/modelo). Padrões em CONFIG_PADRAO. */
export type UnitConfig = {
  /** Fuso IANA da unidade. */
  timeZone: string;
  /** Tamanho da janela protegida (K). */
  windowK: number;
  toleranceMin: number;
  leaveHomeMin: number;
  /** Prazo para o remoto chegar depois do "venha agora" (RN-ETA-06, AD-057). */
  arrivalDeadlineMin: number;
  qrSeconds: number;
  tvHighlightSeconds: number;
  confirmationDeadlineHours: number;
  initialAverageTimeMin: number;
  municipalityOrder: MunicipalityOrder;
  noShowAlert: { noShows: number; days: number };
  stillNeeds: { intervalDays: number; deadlineDays: number };
  /** Sobrepõe o prazo de validade da conferência de cada grupo (D5); vazio = padrões de GRUPOS. */
  priorityDeadlines: Partial<Record<Group, number | null>>;
};
