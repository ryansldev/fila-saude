export type { EstadoEntrada, EstadoItem, EstadoSessao, Transicao } from "./contratos.ts";
export {
  TRANSICOES_ENTRADA,
  TRANSICOES_ITEM,
  TRANSICOES_SESSAO,
  transicionar,
} from "./contratos.ts";
export type { ChaveOrdem, ChaveSugestao } from "./ordem.ts";
export { compararOrdem, compararSugestao } from "./ordem.ts";
export type { Grupo, PrioridadeLegal } from "./prioridade.ts";
export {
  expirada,
  GRUPOS,
  grupoDeDeclarado,
  prioridadeDaPessoa,
  rankPrioridade,
  temPrioridade,
} from "./prioridade.ts";
export { alternarOpcao, classificar } from "./questionario.ts";
export type { CodigoErro, Evento, Resultado, TipoEvento } from "./resultado.ts";
export { falha, ok } from "./resultado.ts";
export { idadeEm, mesmoDia, vespera } from "./tempo.ts";
export type {
  Alarme,
  Classificacao,
  Condicao,
  Gravidade,
  GrupoDeclarado,
  Motivo,
  NivelRisco,
  Respostas,
} from "./tipos.ts";
