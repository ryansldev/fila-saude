import z from "zod";

/** PD-47: o que a TV recebe ao se registrar; o token fica só no navegador dela. */
export const tvRecordSchema = z.object({ code: z.string().regex(/^\d{6}$/), token: z.string().min(32) });
export type TvRecord = z.infer<typeof tvRecordSchema>;

export const callInTvSchema = z.object({
  id: z.string(),
  ticket: z.string(),
  destination: z.string(),
  at: z.iso.datetime(),
});
export type CallInTv = z.infer<typeof callInTvSchema>;

/** RN-TV-01..07: pareando, ou a tela da unidade, só com senhas (RN-TV-05). */
export const tvStateSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("waiting"),
    code: z.string().regex(/^\d{6}$/),
    expiresAt: z.iso.datetime(),
  }),
  z.object({
    state: z.literal("paired"),
    unit: z.object({ id: z.uuid(), name: z.string() }),
    /** Hora do servidor: a TV anuncia e mostra a hora por ela (o relógio da TV pode estar errado). */
    now: z.iso.datetime(),
    /** Fuso da unidade, para o relógio da TV. */
    timeZone: z.string(),
    highlightSeconds: z.number().int(),
    /** Mais recente primeiro; a TV anuncia as novas em fila (RN-TV-07). */
    calls: z.array(callInTvSchema),
    services: z.array(z.object({ name: z.string(), waiting: z.number().int(), onTheWay: z.number().int() })),
    qr: z.object({ content: z.string(), expiresAt: z.iso.datetime() }).nullable(),
    /** Sem estação aberta em nenhuma sessão: "atendimento ainda não começou". */
    careStarted: z.boolean(),
  }),
]);
export type TvState = z.infer<typeof tvStateSchema>;

export const pairingInputSchema = z.object({ code: z.string().regex(/^\d{6}$/, "código de 6 dígitos") });

/** RN-TV-06: indicador online/offline no painel do admin. */
export const unitTvSchema = z.object({
  id: z.uuid(),
  pairedAt: z.iso.datetime(),
  lastSignalAt: z.iso.datetime().nullable(),
  online: z.boolean(),
});
export type UnitTv = z.infer<typeof unitTvSchema>;
