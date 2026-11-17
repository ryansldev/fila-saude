import { GROUP_LABEL, type Group, TARGET_TIME_MIN } from "@fila-saude/domain";
import type { ApiRiskLevel } from "@fila-saude/schemas/queue";

export type TriageColor = {
  level: ApiRiskLevel;
  color: "red" | "orange" | "yellow" | "green" | "blue";
  label: string;
  /** Nome da categoria no Manchester. */
  description: string;
  /** Tempo-alvo para o primeiro atendimento médico, no Manchester padrão. */
  targetTime: string;
  /** Cartão claro: borda e bolinha da cor; marcado, pinta inteiro (laranja e amarelo com texto escuro). */
  tone: { border: string; dot: string; full: string };
};

/** O tempo-alvo do Manchester vem do domínio (o mesmo que a API usa na pílula "o mais antigo"). */
const targetTime = (level: ApiRiskLevel) =>
  TARGET_TIME_MIN[level] === 0 ? "imediato" : `até ${TARGET_TIME_MIN[level]} min`;

/**
 * AD-058: as cinco cores do Sistema Manchester de Classificação de Risco, da mais grave para a
 * mais leve. Vermelho põe a pessoa em 1º lugar no atendimento; encaminhar à emergência é uma ação à parte (AD-059).
 */
export const TRIAGE_COLORS: TriageColor[] = (
  [
    {
      level: "emergency",
      color: "red",
      label: "Vermelho",
      description: "Emergência",
      tone: { border: "border-red-300", dot: "bg-red-600", full: "border-red-700 bg-red-600 text-white" },
    },
    {
      level: "very_urgent",
      color: "orange",
      label: "Laranja",
      description: "Muito urgente",
      tone: {
        border: "border-orange-300",
        dot: "bg-orange-500",
        full: "border-orange-600 bg-orange-500 text-gray-950",
      },
    },
    {
      level: "urgent",
      color: "yellow",
      label: "Amarelo",
      description: "Urgente",
      tone: { border: "border-amber-300", dot: "bg-amber-400", full: "border-amber-500 bg-amber-400 text-gray-950" },
    },
    {
      level: "attention",
      color: "green",
      label: "Verde",
      description: "Pouco urgente",
      tone: { border: "border-green-300", dot: "bg-green-600", full: "border-green-700 bg-green-600 text-white" },
    },
    {
      level: "routine",
      color: "blue",
      label: "Azul",
      description: "Não urgente",
      tone: { border: "border-blue-300", dot: "bg-blue-600", full: "border-blue-700 bg-blue-600 text-white" },
    },
  ] satisfies Omit<TriageColor, "targetTime">[]
).map((c) => ({ ...c, targetTime: targetTime(c.level) }));

export const levelColor = (level: ApiRiskLevel): TriageColor =>
  TRIAGE_COLORS.find((c) => c.level === level) ?? (TRIAGE_COLORS[4] as TriageColor);

/** H3: com alguém chamado na triagem, fechar o chamado pede a cor (a API recusa sem ela). */
export const needsClassify = (stage: "triage" | "care", hasCalled: boolean, chosen: ApiRiskLevel | null): boolean =>
  stage === "triage" && hasCalled && chosen === null;

export const priorityText = (groups: string[]): string =>
  groups.length > 0 ? groups.map((g) => GROUP_LABEL[g as Group] ?? g).join(", ") : "Nenhuma";

/** AD-059: vermelho vai ao 1º lugar do atendimento; encaminhar à emergência é uma ação à parte. */
export const canRefer = (color: ApiRiskLevel | null): boolean => color === "emergency";
