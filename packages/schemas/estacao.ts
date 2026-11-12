import z from "zod";

export const etapaSchema = z.enum(["triagem", "atendimento"]);

export const estacaoEntradaSchema = z.object({
  nome: z.string().trim().min(1),
  etapa: etapaSchema,
  servicos: z.array(z.uuid()).min(1),
});

export type EstacaoEntrada = z.infer<typeof estacaoEntradaSchema>;
