import z from "zod";

export const modoServicoSchema = z.enum(["livre", "requisicao", "regulado"]);

export const servicoEntradaSchema = z.object({
  nome: z.string().trim().min(1),
  prefixo: z.string().regex(/^[A-Z]{1,3}$/, "1 a 3 letras maiúsculas"),
  exigeTriagem: z.boolean(),
  modo: modoServicoSchema,
  tempoMedioMin: z.object({
    triagem: z.number().int().min(1).optional(),
    atendimento: z.number().int().min(1).optional(),
  }),
});

export type ServicoEntrada = z.infer<typeof servicoEntradaSchema>;

export const servicoEdicaoSchema = servicoEntradaSchema.partial();

export const servicoSchema = servicoEntradaSchema.extend({
  id: z.uuid(),
  unidadeId: z.uuid(),
  ativo: z.boolean(),
});

export type ServicoEdicao = z.infer<typeof servicoEdicaoSchema>;
export type Servico = z.infer<typeof servicoSchema>;
