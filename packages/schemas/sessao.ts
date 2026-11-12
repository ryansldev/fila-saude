import z from "zod";

/** Campos de configuração compartilhados por sessão e série. */
export const configSessaoCampos = {
  vagas: z.number().int().min(0).nullable(),
  visibilidade: z.enum(["publica", "privada"]),
  dispensaPreCadastro: z.boolean(),
  profissional: z.string().trim().min(1).nullable(),
  estacoes: z.array(z.uuid()),
};

export const sessaoEntradaSchema = z
  .object({
    servicoId: z.uuid(),
    inicio: z.iso.datetime(),
    fim: z.iso.datetime(),
    ...configSessaoCampos,
  })
  .refine((s) => Date.parse(s.fim) > Date.parse(s.inicio), { message: "fim deve ser depois do início", path: ["fim"] });

export type SessaoEntrada = z.infer<typeof sessaoEntradaSchema>;
