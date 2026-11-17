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

/**
 * AD-058: as cinco cores do Sistema Manchester de Classificação de Risco, da mais grave para a
 * mais leve. Vermelho encaminha à emergência e tira da fila (H2).
 */
export const TRIAGE_COLORS: TriageColor[] = [
  {
    level: "emergency",
    color: "red",
    label: "Vermelho",
    description: "Emergência",
    targetTime: "imediato",
    tone: { border: "border-red-300", dot: "bg-red-600", full: "border-red-700 bg-red-600 text-white" },
  },
  {
    level: "very_urgent",
    color: "orange",
    label: "Laranja",
    description: "Muito urgente",
    targetTime: "até 10 min",
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
    targetTime: "até 60 min",
    tone: { border: "border-amber-300", dot: "bg-amber-400", full: "border-amber-500 bg-amber-400 text-gray-950" },
  },
  {
    level: "attention",
    color: "green",
    label: "Verde",
    description: "Pouco urgente",
    targetTime: "até 120 min",
    tone: { border: "border-green-300", dot: "bg-green-600", full: "border-green-700 bg-green-600 text-white" },
  },
  {
    level: "routine",
    color: "blue",
    label: "Azul",
    description: "Não urgente",
    targetTime: "até 240 min",
    tone: { border: "border-blue-300", dot: "bg-blue-600", full: "border-blue-700 bg-blue-600 text-white" },
  },
];

export const levelColor = (level: ApiRiskLevel): TriageColor =>
  TRIAGE_COLORS.find((c) => c.level === level) ?? (TRIAGE_COLORS[4] as TriageColor);

/** H3: com alguém chamado na triagem, fechar o chamado pede a cor. */
export const needsClassify = (stage: "triage" | "care", hasCalled: boolean, chosen: ApiRiskLevel | null): boolean =>
  stage === "triage" && hasCalled && chosen === null;

const GROUPS: Record<string, string> = {
  elderly: "60 anos ou mais",
  elderly80: "80 anos ou mais",
  pregnant: "gestante",
  infant: "criança de colo",
  disability: "pessoa com deficiência",
  autism: "autismo (TEA)",
  breastfeeding: "lactante",
  mobility: "mobilidade reduzida",
  donor: "doador de sangue",
  obesity: "obesidade",
};

export const priorityText = (groups: string[]): string =>
  groups.length > 0 ? groups.map((g) => GROUPS[g] ?? g).join(", ") : "Nenhuma";

/** AD-059: vermelho vai ao 1º lugar do atendimento; encaminhar à emergência é uma ação à parte. */
export const canRefer = (color: ApiRiskLevel | null): boolean => color === "emergency";
