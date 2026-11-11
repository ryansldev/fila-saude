import z from "zod";
import { configEntradaSchema } from "./config.ts";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const intervaloSchema = z
  .object({ abre: hhmm, fecha: hhmm })
  .refine((h) => h.fecha > h.abre, { message: "fecha deve ser depois de abre", path: ["fecha"] });

/** Chaves "0" (domingo) a "6" (sábado); cada dia pode ter vários intervalos. */
export const horarioSchema = z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(intervaloSchema));

export const unidadeEntradaSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: z.enum(["ubs", "policlinica", "upa"]),
  endereco: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  fuso: z.string().min(1),
  horario: horarioSchema,
  config: configEntradaSchema.optional(),
});

export type UnidadeEntrada = z.infer<typeof unidadeEntradaSchema>;
