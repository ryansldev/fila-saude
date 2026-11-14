import type { Grupo } from "./prioridade.ts";

/** Nível de risco sugerido pelo questionário (Manchester reduzido). */
export type NivelRisco = "emergencia" | "urgente" | "atencao" | "rotina";

/**
 * Tela 1 do questionário v1. "Nenhum destes" não entra aqui: é a lista vazia.
 * - falta_de_ar: falta de ar forte ou dificuldade para respirar
 * - dor_no_peito: dor ou aperto forte no peito
 * - desmaio: desmaio, confusão ou sonolência estranha
 * - fraqueza_de_um_lado: fraqueza, formigamento ou boca torta de repente
 * - sangramento: sangramento que não para
 * - convulsao: convulsão
 * - autolesao: pensamentos de tirar a própria vida ou de se machucar
 */
export type Alarme =
  | "falta_de_ar"
  | "dor_no_peito"
  | "desmaio"
  | "fraqueza_de_um_lado"
  | "sangramento"
  | "convulsao"
  | "autolesao";

/** Tela 2: novo (problema novo ou que piorou), acompanhamento, exame (check-up ou rotina), receita. */
export type Motivo = "novo" | "acompanhamento" | "exame" | "receita";

/** Tela 3, só para motivo "novo". */
export type Gravidade = "leve" | "moderado" | "forte";

/**
 * Tela 4. "Nenhuma" é a lista vazia.
 * - respiratoria: asma, bronquite ou DPOC
 * - coracao: doença do coração
 * - cancer: câncer em tratamento
 * - imunidade_baixa: transplante, HIV, uso de corticoide
 */
export type Condicao = "diabetes" | "pressao_alta" | "coracao" | "respiratoria" | "cancer" | "imunidade_baixa";

/** Tela 5 (prioridade legal, RN-RISCO-04). "Nenhuma" é a lista vazia. */
export type GrupoDeclarado =
  | "gestante"
  | "lactante"
  | "crianca_de_colo"
  | "pcd"
  | "tea"
  | "mobilidade_reduzida"
  | "doador_de_sangue"
  | "obesidade";

export type Respostas = {
  alarmes: Alarme[];
  motivo: Motivo;
  gravidade: Gravidade | null;
  condicoes: Condicao[];
  grupos: GrupoDeclarado[];
};

export type Classificacao = {
  nivel: NivelRisco;
  /** Regra que bateu, em texto para a ficha do agendador (RN-RISCO-05). */
  regra: string;
  /** Mostrar CVV (188) e SAMU (192) em destaque. */
  apoio: boolean;
};

/** Ordem entre risco e prioridade legal (configuração do município, RN-ORD). */
export type OrdemMunicipio = "risco" | "prioridade";

/** Configurações que a fila do dia usa (§ Configurações de specs/modelo). Padrões em CONFIG_PADRAO. */
export type ConfigUnidade = {
  /** Fuso IANA da unidade. */
  fuso: string;
  /** Tamanho da janela protegida (K). */
  janelaK: number;
  toleranciaMin: number;
  saiaDeCasaMin: number;
  /** Prazo para o remoto chegar depois do "venha agora" (RN-ETA-06, AD-057). */
  prazoChegadaMin: number;
  qrSegundos: number;
  destaqueTvSegundos: number;
  prazoConfirmacaoHoras: number;
  tempoMedioInicialMin: number;
  ordemMunicipio: OrdemMunicipio;
  alertaFaltas: { faltas: number; dias: number };
  aindaPrecisa: { intervaloDias: number; prazoDias: number };
  /** Sobrepõe o prazo de validade da conferência de cada grupo (D5); vazio = padrões de GRUPOS. */
  prazosPrioridade: Partial<Record<Grupo, number | null>>;
};
