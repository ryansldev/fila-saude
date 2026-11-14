import type { NivelRiscoApi } from "@fila-saude/schemas/fila";

export type CorDaTriagem = {
  nivel: NivelRiscoApi;
  cor: "vermelho" | "amarelo" | "verde" | "azul";
  rotulo: string;
  descricao: string;
  /** Classes do botão: fundo e texto com contraste (amarelo com texto escuro). */
  classes: string;
};

/**
 * H1: cores do Acolhimento com Classificação de Risco do Ministério da Saúde (AD-056), da mais
 * grave para a mais leve. Vermelho encaminha à emergência e tira da fila (H2).
 */
export const CORES_DA_TRIAGEM: CorDaTriagem[] = [
  {
    nivel: "emergencia",
    cor: "vermelho",
    rotulo: "Vermelho",
    descricao: "Emergência: encaminhar agora",
    classes: "bg-red-600 text-white hover:bg-red-700",
  },
  {
    nivel: "urgente",
    cor: "amarelo",
    rotulo: "Amarelo",
    descricao: "Urgente: primeiro da fila",
    classes: "bg-amber-400 text-gray-950 hover:bg-amber-500",
  },
  {
    nivel: "atencao",
    cor: "verde",
    rotulo: "Verde",
    descricao: "Prioridade não urgente",
    classes: "bg-green-600 text-white hover:bg-green-700",
  },
  {
    nivel: "rotina",
    cor: "azul",
    rotulo: "Azul",
    descricao: "Rotina: ordem de chegada",
    classes: "bg-blue-600 text-white hover:bg-blue-700",
  },
];

export const corDoNivel = (nivel: NivelRiscoApi): CorDaTriagem =>
  CORES_DA_TRIAGEM.find((c) => c.nivel === nivel) ?? (CORES_DA_TRIAGEM[3] as CorDaTriagem);

/** H3: com alguém chamado na triagem, fechar o chamado pede a cor. */
export const precisaClassificar = (
  etapa: "triagem" | "atendimento",
  temChamado: boolean,
  escolhida: NivelRiscoApi | null,
): boolean => etapa === "triagem" && temChamado && escolhida === null;

const GRUPOS: Record<string, string> = {
  idoso: "60 anos ou mais",
  idoso80: "80 anos ou mais",
  gestante: "gestante",
  colo: "criança de colo",
  pcd: "pessoa com deficiência",
  tea: "autismo (TEA)",
  lactante: "lactante",
  mobilidade: "mobilidade reduzida",
  doador: "doador de sangue",
  obesidade: "obesidade",
};

export const textoDaPrioridade = (grupos: string[]): string =>
  grupos.length > 0 ? grupos.map((g) => GRUPOS[g] ?? g).join(", ") : "Nenhuma";
