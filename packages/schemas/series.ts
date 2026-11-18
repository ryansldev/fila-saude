import z from "zod";
import { sessionConfigFields } from "./session.ts";

/** Hora local "flutuante" (PD-26): AAAA-MM-DDTHH:mm, sem fuso nem segundos. */
export const localSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Use AAAA-MM-DDTHH:mm");

export const seriesInputSchema = z.object({
  serviceId: z.uuid(),
  dtstart: localSchema,
  durationMin: z.number().int().min(1),
  rrule: z.string().min(1),
  exdate: z.array(localSchema).default([]),
  rdate: z.array(localSchema).default([]),
  ...sessionConfigFields,
});

export type SeriesInput = z.infer<typeof seriesInputSchema>;
