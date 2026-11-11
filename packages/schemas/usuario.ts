import z from "zod";

export const perfilPainelSchema = z.enum(["gestor", "admin", "agendador", "recepcao", "triagem", "profissional"]);

export const usuarioPainelEntradaSchema = z.object({
  login: z.string().min(3).max(30),
  nome: z.string().trim().min(1),
  senha: z.string().min(8),
  perfis: z.array(z.object({ perfil: perfilPainelSchema, unidadeId: z.uuid().nullable() })).min(1),
});

export type UsuarioPainelEntrada = z.infer<typeof usuarioPainelEntradaSchema>;
