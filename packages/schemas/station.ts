import z from "zod";

export const stageSchema = z.enum(["triage", "care"]);

export const stationInputSchema = z.object({
  name: z.string().trim().min(1),
  stage: stageSchema,
  services: z.array(z.uuid()).min(1),
});

export type StationInput = z.infer<typeof stationInputSchema>;

// A etapa não muda depois de criada.
export const stationEditSchema = z
  .object({ name: z.string().trim().min(1), services: z.array(z.uuid()).min(1) })
  .partial()
  .strict();

export const stationSchema = z.object({
  id: z.uuid(),
  unitId: z.uuid(),
  name: z.string(),
  stage: stageSchema,
  services: z.array(z.uuid()),
  open: z.boolean(),
});

export type StationEdit = z.infer<typeof stationEditSchema>;
export type Station = z.infer<typeof stationSchema>;
