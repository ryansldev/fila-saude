import z from "zod";

export const tvEstadoSchema = z.discriminatedUnion("estado", [
  z.object({
    estado: z.literal("aguardando"),
    codigo: z.string().regex(/^\d{6}$/),
    expiraEm: z.iso.datetime(),
  }),
  z.object({
    estado: z.literal("pareada"),
    unidade: z.object({ id: z.uuid(), nome: z.string() }),
  }),
]);

export type TvEstado = z.infer<typeof tvEstadoSchema>;
