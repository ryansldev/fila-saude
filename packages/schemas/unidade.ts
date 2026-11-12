import z from "zod";
import { configEntradaSchema } from "./config.ts";

const fusoValido = (fuso: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const intervaloSchema = z
  .object({ abre: hhmm, fecha: hhmm })
  .refine((h) => h.fecha > h.abre, { message: "fecha deve ser depois de abre", path: ["fecha"] });

/** Chaves "0" (domingo) a "6" (sábado); cada dia pode ter vários intervalos. */
export const horarioSchema = z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(intervaloSchema));

// Endereço da unidade; cidade e UF vêm do município.
export const enderecoSchema = z.object({
  cep: z
    .string()
    .transform((t) => t.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "CEP com 8 dígitos")),
  logradouro: z.string().trim().min(1),
  numero: z.string().trim().min(1).max(10),
  complemento: z.string().trim().max(60).nullable().optional(),
  bairro: z.string().trim().min(1),
});

export const unidadeEntradaSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: z.enum(["ubs", "policlinica", "upa"]),
  // Código do estabelecimento no CNES (7 dígitos); opcional na v0.1.
  cnes: z
    .string()
    .regex(/^\d{7}$/, "CNES com 7 dígitos")
    .nullable()
    .optional(),
  endereco: enderecoSchema,
  // Coordenadas opcionais (mapa e distância, depois).
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  fuso: z.string().refine(fusoValido, "Fuso IANA inválido"),
  horario: horarioSchema,
  config: configEntradaSchema.optional(),
});

export type UnidadeEntrada = z.infer<typeof unidadeEntradaSchema>;
export type Endereco = z.infer<typeof enderecoSchema>;

// `null` num campo da config = voltar a herdar (PD-28).
export const unidadeEdicaoSchema = unidadeEntradaSchema.partial();

export const unidadeSchema = unidadeEntradaSchema.extend({
  id: z.uuid(),
  config: configEntradaSchema,
});

export const configEfetivaSchema = z.object({
  valores: z.record(z.string(), z.unknown()),
  origem: z.record(z.string(), z.enum(["padrao", "municipio", "unidade"])),
});

export type UnidadeEdicao = z.infer<typeof unidadeEdicaoSchema>;
export type Unidade = z.infer<typeof unidadeSchema>;
export type ConfigEfetivaSaida = z.infer<typeof configEfetivaSchema>;
