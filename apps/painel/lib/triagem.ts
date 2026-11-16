import type { NivelRiscoApi } from "@fila-saude/schemas/fila";

export type CorDaTriagem = {
  nivel: NivelRiscoApi;
  cor: "vermelho" | "laranja" | "amarelo" | "verde" | "azul";
  rotulo: string;
  /** Nome da categoria no Manchester. */
  descricao: string;
  /** Tempo-alvo para o primeiro atendimento médico, no Manchester padrão. */
  tempoAlvo: string;
  /** Cartão claro: borda e bolinha da cor; marcado, pinta inteiro (laranja e amarelo com texto escuro). */
  tom: { borda: string; bolinha: string; cheio: string };
};

/**
 * AD-058: as cinco cores do Sistema Manchester de Classificação de Risco, da mais grave para a
 * mais leve. Vermelho encaminha à emergência e tira da fila (H2).
 */
export const CORES_DA_TRIAGEM: CorDaTriagem[] = [
  {
    nivel: "emergencia",
    cor: "vermelho",
    rotulo: "Vermelho",
    descricao: "Emergência",
    tempoAlvo: "imediato",
    tom: { borda: "border-red-300", bolinha: "bg-red-600", cheio: "border-red-700 bg-red-600 text-white" },
  },
  {
    nivel: "muito_urgente",
    cor: "laranja",
    rotulo: "Laranja",
    descricao: "Muito urgente",
    tempoAlvo: "até 10 min",
    tom: {
      borda: "border-orange-300",
      bolinha: "bg-orange-500",
      cheio: "border-orange-600 bg-orange-500 text-gray-950",
    },
  },
  {
    nivel: "urgente",
    cor: "amarelo",
    rotulo: "Amarelo",
    descricao: "Urgente",
    tempoAlvo: "até 60 min",
    tom: { borda: "border-amber-300", bolinha: "bg-amber-400", cheio: "border-amber-500 bg-amber-400 text-gray-950" },
  },
  {
    nivel: "atencao",
    cor: "verde",
    rotulo: "Verde",
    descricao: "Pouco urgente",
    tempoAlvo: "até 120 min",
    tom: { borda: "border-green-300", bolinha: "bg-green-600", cheio: "border-green-700 bg-green-600 text-white" },
  },
  {
    nivel: "rotina",
    cor: "azul",
    rotulo: "Azul",
    descricao: "Não urgente",
    tempoAlvo: "até 240 min",
    tom: { borda: "border-blue-300", bolinha: "bg-blue-600", cheio: "border-blue-700 bg-blue-600 text-white" },
  },
];

export const corDoNivel = (nivel: NivelRiscoApi): CorDaTriagem =>
  CORES_DA_TRIAGEM.find((c) => c.nivel === nivel) ?? (CORES_DA_TRIAGEM[4] as CorDaTriagem);

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

/** AD-059: vermelho vai ao 1º lugar do atendimento; encaminhar à emergência é uma ação à parte. */
export const podeEncaminhar = (cor: NivelRiscoApi | null): boolean => cor === "emergencia";
