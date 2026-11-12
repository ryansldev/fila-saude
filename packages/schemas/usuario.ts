import z from "zod";

export const perfilPainelSchema = z.enum(["gestor", "admin", "agendador", "recepcao", "triagem", "profissional"]);

export const perfilComEscopoSchema = z.object({ perfil: perfilPainelSchema, unidadeId: z.uuid().nullable() });

export const usuarioPainelEntradaSchema = z.object({
  login: z.string().min(3).max(30),
  nome: z.string().trim().min(1),
  senha: z.string().min(8),
  perfis: z.array(perfilComEscopoSchema).min(1),
});

export type UsuarioPainelEntrada = z.infer<typeof usuarioPainelEntradaSchema>;

export const perfisEntradaSchema = z.object({ perfis: z.array(perfilComEscopoSchema).min(1) });

export const usuarioPainelSchema = z.object({
  id: z.string(),
  login: z.string(),
  nome: z.string(),
  perfis: z.array(perfilComEscopoSchema),
});

export type PerfilComEscopo = z.infer<typeof perfilComEscopoSchema>;
export type PerfisEntrada = z.infer<typeof perfisEntradaSchema>;
export type UsuarioPainel = z.infer<typeof usuarioPainelSchema>;
