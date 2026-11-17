export type Mode = "direct" | "referral" | "regulated";

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

/** A coluna "Tempo médio": só o que foi informado; sem nada, a estimativa usa o padrão da unidade. */
export function averageTimeText(t: { triage?: number | undefined; care?: number | undefined }): string {
  if (t.triage && t.care) return `${t.triage} min + ${t.care} min`;
  if (t.care) return `${t.care} min`;
  if (t.triage) return `${t.triage} min na triagem`;
  return "padrão da unidade";
}
