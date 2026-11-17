export type EffectiveConfig = { values: Record<string, unknown>; origin: Record<string, string> };

const ORIGINS: Record<string, string> = { default: "do padrão", municipality: "do município", unit: "da unidade" };

/** Campos numéricos da configuração que a tela da unidade mostra. */
export const CONFIG_FIELDS = [
  { field: "windowK", label: "Janela de chamada (K)" },
  { field: "toleranceMin", label: "Tolerância (min)" },
  { field: "leaveHomeMin", label: 'Aviso "saia de casa" (min)' },
  { field: "confirmationDeadlineHours", label: "Prazo de confirmação (h)" },
] as const;

/** PD-28: valor efetivo e de onde vem; `own` = a unidade definiu. */
export function inheritedField(effective: EffectiveConfig, field: string) {
  const value = effective.values[field];
  const origin = effective.origin[field] ?? "default";
  return {
    value,
    origin,
    own: origin === "unit",
    text: `herdado ${ORIGINS[origin] ?? origin}: ${String(value)}`,
  };
}

/** Campo vazio que era próprio vai como `null` (volta a herdar); vazio que já herdava não vai. */
export function configForSending(values: Record<string, string>, own: string[]): Record<string, number | null> {
  const exit: Record<string, number | null> = {};
  for (const [field, text] of Object.entries(values)) {
    if (text.trim() === "") {
      if (own.includes(field)) exit[field] = null;
    } else exit[field] = Number(text);
  }
  return exit;
}
