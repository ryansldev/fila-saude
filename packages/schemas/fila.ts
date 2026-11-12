import z from "zod";
import { sessaoSchema } from "./sessao";

// Fatia 1 da v0.1: fila do dia (painel), operação da estação e as telas do app.

export const etapaSchema = z.enum(["triagem", "atendimento"]);
export const estadoItemSchema = z.enum(["remoto", "presente", "chamado", "atendido_na_etapa", "saiu_da_fila", "remanejado"]);

/** Item da fila como o painel vê: nome para a equipe; nada clínico além do nível de risco usado na ordem. */
export const itemDaFilaSchema = z.object({
  id: z.string(),
  senha: z.string(),
  nome: z.string(),
  etapa: etapaSchema,
  estado: estadoItemSchema,
  pulos: z.number().int().min(0),
  risco: z.enum(["urgente", "atencao", "rotina"]),
  prioridade: z.boolean(),
  estacaoId: z.string().nullable(),
});

export const filaDaSessaoSchema = z.object({
  sessao: sessaoSchema,
  itens: z.array(itemDaFilaSchema),
  reserva: z.number().int().min(0),
});
export type ItemDaFila = z.infer<typeof itemDaFilaSchema>;
export type FilaDaSessao = z.infer<typeof filaDaSessaoSchema>;

export const chamadoSchema = z.object({
  itemId: z.string(),
  senha: z.string(),
  nome: z.string(),
  etapa: etapaSchema,
  pulos: z.number().int().min(0),
  chamadoEm: z.iso.datetime(),
  toleranciaEsgotada: z.boolean(),
});

/** Tela da estação (T3.7): a sessão aberta de hoje que ela atende, o chamado e quantos aguardam presentes. */
export const operacaoEstacaoSchema = z.object({
  estacao: z.object({ id: z.uuid(), nome: z.string(), etapa: etapaSchema }),
  sessao: z.object({ id: z.uuid(), servico: z.string(), estado: z.string() }).nullable(),
  chamado: chamadoSchema.nullable(),
  aguardando: z.number().int().min(0),
  remotos: z.number().int().min(0),
  toleranciaMin: z.number().int().min(0),
  aviso: z.enum(["ninguem_aguardando"]).nullable(),
});
export type OperacaoEstacao = z.infer<typeof operacaoEstacaoSchema>;

export const comandoEstacaoSchema = z.enum(["chamar", "rechamar", "finalizar", "nao-compareceu"]);
export type ComandoEstacao = z.infer<typeof comandoEstacaoSchema>;

// ---- App do paciente ----

export const municipioPublicoSchema = z.object({ slug: z.string(), nome: z.string(), uf: z.string().nullable() });

/** Agenda pública (T3.2): só dados da sessão, nunca de paciente. */
export const sessaoDaAgendaSchema = z.object({
  id: z.uuid(),
  unidade: z.object({ id: z.uuid(), nome: z.string(), bairro: z.string() }),
  servico: z.object({ id: z.uuid(), nome: z.string() }),
  inicio: z.iso.datetime(),
  fim: z.iso.datetime(),
  profissional: z.string().nullable(),
  vagasRestantes: z.number().int().min(0).nullable(),
  estado: z.enum(["planejada", "aberta"]),
});
export type SessaoDaAgenda = z.infer<typeof sessaoDaAgendaSchema>;

export const respostasSchema = z.object({
  alarmes: z.array(
    z.enum(["falta_de_ar", "dor_no_peito", "desmaio", "fraqueza_de_um_lado", "sangramento", "convulsao", "autolesao"]),
  ),
  motivo: z.enum(["novo", "acompanhamento", "exame", "receita"]),
  gravidade: z.enum(["leve", "moderado", "forte"]).nullable(),
  condicoes: z.array(z.enum(["diabetes", "pressao_alta", "coracao", "respiratoria", "cancer", "imunidade_baixa"])),
  grupos: z.array(
    z.enum([
      "gestante",
      "lactante",
      "crianca_de_colo",
      "pcd",
      "tea",
      "mobilidade_reduzida",
      "doador_de_sangue",
      "obesidade",
    ]),
  ),
});

/** "Para quem é?" (AD-018): eu (dados da conta) ou outra pessoa. */
export const inscricaoEntradaSchema = z.object({
  paraQuem: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("eu") }),
    z.object({
      tipo: z.literal("outra"),
      nome: z.string().trim().min(3),
      nascimento: z.iso.date(),
      cpf: z.string().nullable(),
    }),
  ]),
  respostas: respostasSchema,
});
export type InscricaoEntrada = z.infer<typeof inscricaoEntradaSchema>;

export const estimativaSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("posicao"),
    posicao: z.number().int(),
    minutos: z.number().int(),
    consulta: z.object({ minutos: z.number() }).optional(),
  }),
  z.object({ tipo: z.literal("venha_agora"), consulta: z.object({ minutos: z.number() }).optional() }),
  z.object({ tipo: z.literal("aguardando_inicio") }),
  z.object({ tipo: z.literal("modo_manual") }),
  z.object({ tipo: z.literal("chamado") }),
  z.object({ tipo: z.literal("fora_da_fila") }),
]);

/** O que o app mostra de cada entrada do paciente (INV-06: só dele). Mesmo formato que o SSE terá (PD-33). */
export const minhaEntradaSchema = z.object({
  entradaId: z.uuid(),
  pessoa: z.string(),
  estado: z.string(),
  servico: z.string(),
  unidade: z.string(),
  sessao: z
    .object({ id: z.uuid(), inicio: z.iso.datetime(), fim: z.iso.datetime(), estado: z.string() })
    .nullable(),
  senha: z.string().nullable(),
  itemEstado: estadoItemSchema.nullable(),
  estimativa: estimativaSchema.nullable(),
  chamada: z.object({ estacao: z.string(), em: z.iso.datetime() }).nullable(),
});
export type MinhaEntrada = z.infer<typeof minhaEntradaSchema>;

export const inscricaoSchema = z.object({
  entradaId: z.uuid(),
  estado: z.string(),
  classificacao: z.object({ nivel: z.string(), apoio: z.boolean() }),
});
