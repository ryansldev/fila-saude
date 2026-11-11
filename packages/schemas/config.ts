import z from "zod";

const inteiro = (min: number) => z.number().int().min(min).nullable().optional();

/**
 * Configuração com herança (PD-28): ausente ou nulo herda do nível acima; o padrão final é
 * CONFIG_PADRAO do domínio. Vale para município, unidade e (parcialmente) serviço/sessão.
 */
export const configEntradaSchema = z.object({
  janelaK: inteiro(1),
  toleranciaMin: inteiro(0),
  saiaDeCasaMin: inteiro(0),
  qrSegundos: inteiro(1),
  destaqueTvSegundos: inteiro(1),
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
});

export const configMunicipioSchema = configEntradaSchema;

export type ConfigEntrada = z.infer<typeof configEntradaSchema>;
export type ConfigMunicipio = z.infer<typeof configMunicipioSchema>;
