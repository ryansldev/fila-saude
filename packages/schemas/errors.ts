import z from "zod";

// PD-22: formato único de erro da API (`dados`: contexto do 409, ex.: `activeEntries`).
export const errorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type ErrorSchema = z.infer<typeof errorSchema>;
