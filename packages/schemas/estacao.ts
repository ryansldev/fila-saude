import z from "zod";

export const etapaSchema = z.enum(["triagem", "atendimento"]);

export const estacaoEntradaSchema = z.object({
  nome: z.string().trim().min(1),
  etapa: etapaSchema,
  servicos: z.array(z.uuid()).min(1),
});

export type EstacaoEntrada = z.infer<typeof estacaoEntradaSchema>;

// A etapa não muda depois de criada.
export const estacaoEdicaoSchema = z
  .object({ nome: z.string().trim().min(1), servicos: z.array(z.uuid()).min(1) })
  .partial()
  .strict();

export const estacaoSchema = z.object({
  id: z.uuid(),
  unidadeId: z.uuid(),
  nome: z.string(),
  etapa: etapaSchema,
  servicos: z.array(z.uuid()),
  aberta: z.boolean(),
});

export type EstacaoEdicao = z.infer<typeof estacaoEdicaoSchema>;
export type Estacao = z.infer<typeof estacaoSchema>;
