import z from "zod";

// Discovery-papeis-ubs / RN-PERF-04. Listas iguais às do domínio (`equipe.ts`, `permissoes.ts`).
export const ocupacaoSchema = z.enum([
  "medico",
  "enfermeiro",
  "tecnico_enfermagem",
  "cirurgiao_dentista",
  "auxiliar_saude_bucal",
  "acs",
  "recepcao",
  "farmaceutico",
  "psicologo",
  "fisioterapeuta",
  "nutricionista",
  "assistente_social",
]);
export const funcaoSchema = z.enum(["gestao_sms", "regulacao_sms", "gerente_ubs", "agendar"]);

/** Papéis de permissão do painel (colunas da matriz, sem paciente). */
export const papelPainelSchema = z.enum([
  "gestao_sms",
  "regulacao_sms",
  "gerente_ubs",
  "agendar",
  "recepcao",
  "enfermeiro",
  "tecnico_enfermagem",
  "atendimento",
]);

export const vinculoSchema = z.object({ unidadeId: z.uuid(), ocupacao: ocupacaoSchema });
export const funcaoComEscopoSchema = z.object({ funcao: funcaoSchema, unidadeId: z.uuid().nullable() });
export const papelComEscopoSchema = z.object({ perfil: papelPainelSchema, unidadeId: z.uuid().nullable() });

export const atribuicoesSchema = z.object({
  vinculos: z.array(vinculoSchema),
  funcoes: z.array(funcaoComEscopoSchema),
});

export const usuarioPainelEntradaSchema = atribuicoesSchema.extend({
  login: z.string().min(3).max(30),
  nome: z.string().trim().min(1),
  senha: z.string().min(8),
});

export const usuarioPainelSchema = atribuicoesSchema.extend({
  id: z.string(),
  login: z.string(),
  nome: z.string(),
});

export type Ocupacao = z.infer<typeof ocupacaoSchema>;
export type FuncaoPainel = z.infer<typeof funcaoSchema>;
export type PapelComEscopo = z.infer<typeof papelComEscopoSchema>;
export type AtribuicoesEntrada = z.infer<typeof atribuicoesSchema>;
export type UsuarioPainelEntrada = z.infer<typeof usuarioPainelEntradaSchema>;
export type UsuarioPainel = z.infer<typeof usuarioPainelSchema>;
