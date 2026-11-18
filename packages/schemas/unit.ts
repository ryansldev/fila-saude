import z from "zod";
import { configInputSchema } from "./config.ts";

const validTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timeZone });
    return true;
  } catch {
    return false;
  }
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const intervalSchema = z
  .object({ opens: hhmm, closes: hhmm })
  .refine((h) => h.closes > h.opens, { message: "fecha deve ser depois de abre", path: ["closes"] });

/** Intervalos de um dia, sem sobreposição (encostados valem: 07:00–13:00 e 13:00–17:00). Vazio = fechado. */
const dayIntervals = z.array(intervalSchema).superRefine((list, ctx) => {
  const sorted = [...list].sort((a, b) => a.opens.localeCompare(b.opens));
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i]?.opens ?? "") < (sorted[i - 1]?.closes ?? "")) {
      ctx.addIssue({ code: "custom", message: "intervalos sobrepostos no mesmo dia" });
      return;
    }
  }
});

/** Chaves "0" (domingo) a "6" (sábado); cada dia pode ter vários intervalos. */
export const timeSchema = z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), dayIntervals);

// Endereço da unidade; cidade e UF vêm do município.
export const addressSchema = z.object({
  postalCode: z
    .string()
    .transform((t) => t.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "CEP com 8 dígitos")),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1).max(10),
  complement: z.string().trim().max(60).nullable().optional(),
  neighborhood: z.string().trim().min(1),
});

export const unitKindSchema = z.enum(["ubs", "polyclinic", "upa"]);
export type UnitKind = z.infer<typeof unitKindSchema>;

export const unitInputSchema = z.object({
  name: z.string().trim().min(1),
  kind: unitKindSchema,
  // Código do estabelecimento no CNES (7 dígitos); opcional na v0.1.
  cnes: z
    .string()
    .regex(/^\d{7}$/, "CNES com 7 dígitos")
    .nullable()
    .optional(),
  address: addressSchema,
  // Coordenadas opcionais (mapa e distância, depois).
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  timeZone: z.string().refine(validTimeZone, "Fuso IANA inválido"),
  time: timeSchema,
  config: configInputSchema.optional(),
});

export type UnitInput = z.infer<typeof unitInputSchema>;
export type Address = z.infer<typeof addressSchema>;

// `null` num campo da config = voltar a herdar (PD-28).
export const unitEditSchema = unitInputSchema.partial();

export const unitSchema = unitInputSchema.extend({
  id: z.uuid(),
  config: configInputSchema,
});

export const effectiveConfigSchema = z.object({
  values: z.record(z.string(), z.unknown()),
  origin: z.record(z.string(), z.enum(["default", "municipality", "unit"])),
});

export type UnitEdit = z.infer<typeof unitEditSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type EffectiveConfigOutput = z.infer<typeof effectiveConfigSchema>;

/** O que acontece hoje em cada unidade, para a troca de unidade no menu do painel. */
export const todaySummarySchema = z.object({
  unitId: z.uuid(),
  open: z.number().int().min(0),
  /** Início da primeira sessão de hoje ainda planejada; `null` sem nenhuma. */
  nextOpening: z.iso.datetime().nullable(),
});
export type TodaySummary = z.infer<typeof todaySummarySchema>;
