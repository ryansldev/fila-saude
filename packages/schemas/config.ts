import z from "zod";

const inteiro = (min: number, max?: number) => {
  const n = z.number().int().min(min);
  return (max === undefined ? n : n.max(max)).nullable().optional();
};
const booleano = z.boolean().nullable().optional();

/**
 * Configuração com herança (PD-28): ausente ou nulo herda do nível acima; o padrão final é
 * CONFIG_PADRAO do domínio. `fuso` fica só em `unidade` (obrigatório lá, não herdado do município).
 * Limites iguais aos de `validarConfig` do domínio. Vale para município, unidade e (parcialmente) serviço/sessão.
 */
export const configEntradaSchema = z.object({
  janelaK: inteiro(1),
  toleranciaMin: inteiro(1),
  saiaDeCasaMin: inteiro(1),
  qrSegundos: inteiro(10, 300),
  destaqueTvSegundos: inteiro(3, 60),
  prazoConfirmacaoHoras: inteiro(1),
  tempoMedioInicialMin: inteiro(1),
  ordemMunicipio: z.enum(["risco", "prioridade"]).nullable().optional(),
  alertaFaltas: z
    .object({ faltas: z.number().int().min(1), dias: z.number().int().min(1) })
    .nullable()
    .optional(),
  aindaPrecisa: z
    .object({ intervaloDias: z.number().int().min(1), prazoDias: z.number().int().min(1) })
    .nullable()
    .optional(),
  exigePreCadastro: booleano,
  soVinculados: booleano,
  umaUnidadePorVez: booleano,
});

export const configMunicipioSchema = configEntradaSchema;

export type ConfigEntrada = z.infer<typeof configEntradaSchema>;
export type ConfigMunicipio = z.infer<typeof configMunicipioSchema>;
