import z from "zod";

const integer = (min: number, max?: number) => {
  const n = z.number().int().min(min);
  return (max === undefined ? n : n.max(max)).nullable().optional();
};
const boolean = z.boolean().nullable().optional();

/**
 * Configuração com herança (PD-28): ausente ou nulo herda do nível acima; o padrão final é
 * CONFIG_PADRAO do domínio. `fuso` fica só em `unidade` (obrigatório lá, não herdado do município).
 * Limites iguais aos de `validarConfig` do domínio. Vale para município, unidade e (parcialmente) serviço/sessão.
 */
export const configInputSchema = z.object({
  windowK: integer(1),
  toleranceMin: integer(1),
  leaveHomeMin: integer(1),
  qrSeconds: integer(10, 300),
  tvHighlightSeconds: integer(3, 60),
  confirmationDeadlineHours: integer(1),
  initialAverageTimeMin: integer(1),
  municipalityOrder: z.enum(["risk", "priority"]).nullable().optional(),
  noShowAlert: z
    .object({ noShows: z.number().int().min(1), days: z.number().int().min(1) })
    .nullable()
    .optional(),
  stillNeeds: z
    .object({ intervalDays: z.number().int().min(1), deadlineDays: z.number().int().min(1) })
    .nullable()
    .optional(),
  requiresPreRegistration: boolean,
  onlyLinked: boolean,
  oneUnitAtATime: boolean,
});

export const municipalityConfigSchema = configInputSchema;

export type ConfigInput = z.infer<typeof configInputSchema>;
export type MunicipalityConfig = z.infer<typeof municipalityConfigSchema>;
