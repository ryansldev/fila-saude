import z from "zod";

/** Campos de configuração compartilhados por sessão e série. */
export const configSessaoCampos = {
  vagas: z.number().int().min(1).nullable(),
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

export const estadoSessaoSchema = z.enum(["planejada", "aberta", "encerrada", "cancelada"]);

// Edição: horário e configuração; `versao` é a trava otimista (PD-37).
export const sessaoEdicaoSchema = z
  .object({
    inicio: z.iso.datetime(),
    fim: z.iso.datetime(),
    vagas: configSessaoCampos.vagas,
    profissional: configSessaoCampos.profissional,
    estacoes: configSessaoCampos.estacoes,
  })
  .partial()
  .extend({ versao: z.number().int().min(0) });

// RN-PUB-03.
export const visibilidadeEntradaSchema = z.object({
  visibilidade: configSessaoCampos.visibilidade,
  dispensaPreCadastro: z.boolean().optional(),
  versao: z.number().int().min(0),
});

export const sessaoSchema = z.object({
  id: z.uuid(),
  servicoId: z.uuid(),
  inicio: z.iso.datetime(),
  fim: z.iso.datetime(),
  ocupadas: z.number().int().min(0),
  estado: estadoSessaoSchema,
  versao: z.number().int().min(0),
  ...configSessaoCampos,
});

export type SessaoEdicao = z.infer<typeof sessaoEdicaoSchema>;
export type VisibilidadeEntrada = z.infer<typeof visibilidadeEntradaSchema>;
export type Sessao = z.infer<typeof sessaoSchema>;
