import z from "zod";

// PD-22: formato único de erro da API.
export const erroSchema = z.object({
  erro: z.string(),
  mensagem: z.string().optional(),
  campos: z.record(z.string(), z.array(z.string())).optional(),
});

export type ErroSchema = z.infer<typeof erroSchema>;
