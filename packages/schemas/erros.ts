import z from "zod";

// PD-22: formato único de erro da API (`dados`: contexto do 409, ex.: `entradasAtivas`).
export const erroSchema = z.object({
  erro: z.string(),
  mensagem: z.string().optional(),
  campos: z.record(z.string(), z.array(z.string())).optional(),
  dados: z.record(z.string(), z.unknown()).optional(),
});

export type ErroSchema = z.infer<typeof erroSchema>;
