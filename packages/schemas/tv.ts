import z from "zod";

/** PD-47: o que a TV recebe ao se registrar; o token fica só no navegador dela. */
export const tvRegistroSchema = z.object({ codigo: z.string().regex(/^\d{6}$/), token: z.string().min(32) });
export type TvRegistro = z.infer<typeof tvRegistroSchema>;

export const chamadaNaTvSchema = z.object({
  id: z.string(),
  senha: z.string(),
  destino: z.string(),
  em: z.iso.datetime(),
});
export type ChamadaNaTv = z.infer<typeof chamadaNaTvSchema>;

/** RN-TV-01..07: pareando, ou a tela da unidade, só com senhas (RN-TV-05). */
export const tvEstadoSchema = z.discriminatedUnion("estado", [
  z.object({
    estado: z.literal("aguardando"),
    codigo: z.string().regex(/^\d{6}$/),
    expiraEm: z.iso.datetime(),
  }),
  z.object({
    estado: z.literal("pareada"),
    unidade: z.object({ id: z.uuid(), nome: z.string() }),
    destaqueSegundos: z.number().int(),
    /** Mais recente primeiro; a TV anuncia as novas em fila (RN-TV-07). */
    chamadas: z.array(chamadaNaTvSchema),
    servicos: z.array(z.object({ nome: z.string(), aguardando: z.number().int(), aCaminho: z.number().int() })),
    qr: z.object({ conteudo: z.string(), expiraEm: z.iso.datetime() }).nullable(),
    /** Sem estação aberta em nenhuma sessão: "atendimento ainda não começou". */
    atendimentoIniciado: z.boolean(),
  }),
]);
export type TvEstado = z.infer<typeof tvEstadoSchema>;

export const pareamentoEntradaSchema = z.object({ codigo: z.string().regex(/^\d{6}$/, "código de 6 dígitos") });

/** RN-TV-06: indicador online/offline no painel do admin. */
export const tvDaUnidadeSchema = z.object({
  id: z.uuid(),
  pareadaEm: z.iso.datetime(),
  ultimoSinalEm: z.iso.datetime().nullable(),
  online: z.boolean(),
});
export type TvDaUnidade = z.infer<typeof tvDaUnidadeSchema>;
