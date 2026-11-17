import type { UnitConfig } from "./kinds.ts";
import { DEFAULT_CONFIG } from "./queue.ts";

/** Configuração em um nível da herança: ausente ou nulo = herda (PD-28). */
export type PartialConfig = Partial<UnitConfig> & {
  requiresPreRegistration?: boolean;
  onlyLinked?: boolean;
  oneUnitAtATime?: boolean;
};

export type ConfigOrigin = "default" | "municipality" | "unit";

export type EffectiveConfig = UnitConfig & {
  requiresPreRegistration: boolean;
  onlyLinked: boolean;
  oneUnitAtATime: boolean;
  origin: Record<string, ConfigOrigin>;
};

type Base = UnitConfig & {
  requiresPreRegistration: boolean;
  onlyLinked: boolean;
  oneUnitAtATime: boolean;
};

/** Padrões finais: CONFIG_PADRAO + pré-cadastro ligado (AD-053), vínculo e uma unidade por vez desligados. */
const DEFAULT: Base = {
  ...DEFAULT_CONFIG,
  requiresPreRegistration: true,
  onlyLinked: false,
  oneUnitAtATime: false,
};

/** unidade → município → padrão; nulo ou ausente herda. */
export function effectiveConfig(levels: { municipality: PartialConfig; unit: PartialConfig }): EffectiveConfig {
  const value: Record<string, unknown> = {};
  const origin: Record<string, ConfigOrigin> = {};
  for (const field of Object.keys(DEFAULT)) {
    const chain: [ConfigOrigin, Record<string, unknown>][] = [
      ["unit", levels.unit],
      ["municipality", levels.municipality],
    ];
    let found = false;
    for (const [name, level] of chain) {
      const v = level[field];
      if (v !== undefined && v !== null) {
        value[field] = v;
        origin[field] = name;
        found = true;
        break;
      }
    }
    if (!found) {
      value[field] = (DEFAULT as Record<string, unknown>)[field];
      origin[field] = "default";
    }
  }
  return { ...(value as Base), origin };
}

export type ValidationResult = { ok: true } | { ok: false; fields: Record<string, string> };

const validTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timeZone });
    return true;
  } catch {
    return false;
  }
};

const integerBetween = (v: number, min: number, max = Number.POSITIVE_INFINITY) =>
  Number.isInteger(v) && v >= min && v <= max;

/** Valida os campos presentes; ausente/nulo não é validado (herda). */
export function validateConfig(c: PartialConfig): ValidationResult {
  const fields: Record<string, string> = {};
  const checks = (field: keyof UnitConfig, ok: (v: never) => boolean, msg: string): void => {
    const v = c[field];
    if (v !== undefined && v !== null && !ok(v as never)) fields[field] = msg;
  };
  checks("windowK", (v: number) => integerBetween(v, 1), "K deve ser inteiro ≥ 1");
  checks("toleranceMin", (v: number) => integerBetween(v, 1), "tolerância deve ser ≥ 1 min");
  checks("leaveHomeMin", (v: number) => integerBetween(v, 1), '"saia de casa" deve ser ≥ 1 min');
  checks("arrivalDeadlineMin", (v: number) => integerBetween(v, 1), "prazo de chegada deve ser ≥ 1 min");
  checks("qrSeconds", (v: number) => integerBetween(v, 10, 300), "QR deve ficar entre 10 e 300 s");
  checks("tvHighlightSeconds", (v: number) => integerBetween(v, 3, 60), "destaque da TV deve ficar entre 3 e 60 s");
  checks("confirmationDeadlineHours", (v: number) => integerBetween(v, 1), "prazo de confirmação deve ser ≥ 1 h");
  checks(
    "noShowAlert",
    (v: { noShows: number; days: number }) => integerBetween(v.noShows, 1) && integerBetween(v.days, 1),
    "faltas e dias devem ser ≥ 1",
  );
  checks("timeZone", (v: string) => validTimeZone(v), "fuso IANA inválido");
  // Com 0, toda estimativa dá 0 min e todo remoto recebe "saia de casa" na abertura.
  checks("initialAverageTimeMin", (v: number) => integerBetween(v, 1, 480), "tempo médio inicial entre 1 e 480 min");
  checks("municipalityOrder", (v: string) => v === "risk" || v === "priority", "ordem deve ser risco ou prioridade");
  return Object.keys(fields).length === 0 ? { ok: true } : { ok: false, fields };
}
