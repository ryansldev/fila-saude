export type Mode = "direct" | "referral" | "regulated";

export const MODE_LABELS: Record<Mode, string> = {
  direct: "Livre (paciente entra na lista)",
  referral: "Com requisição (validada pela unidade)",
  regulated: "Regulado (vaga vem da regulação)",
};

/** Onde o erro dos minutos aparece: o caminho do campo no schema do serviço. */
export const MINUTES_FIELD = { triage: "averageTimeMin.triage", care: "averageTimeMin.care" } as const;

export function showsTriageTime(requiresTriage: boolean): boolean {
  return requiresTriage;
}

export type ServiceValues = {
  name: string;
  prefix: string;
  requiresTriage: boolean;
  mode: Mode;
  triage: string;
  care: string;
};

export function serviceForSending(v: ServiceValues) {
  const averageTimeMin: { triage?: number; care?: number } = {};
  if (v.requiresTriage && v.triage.trim()) averageTimeMin.triage = Number(v.triage);
  if (v.care.trim()) averageTimeMin.care = Number(v.care);
  return {
    name: v.name.trim(),
    prefix: v.prefix.trim().toUpperCase(),
    requiresTriage: v.requiresTriage,
    mode: v.mode,
    averageTimeMin,
  };
}
