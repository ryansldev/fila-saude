import type { Situacao } from "@/lib/textos";

/** Quem vira o bilhete da aba "hoje": o que mais pede ação agora vem primeiro. */
function peso(sit: Situacao): number {
  switch (sit.tipo) {
    case "vez":
      return 0;
    case "venha":
      return 1;
    case "recepcao":
      return 2;
    case "posicao":
      return sit.presente ? 3 : 4;
    case "sem_previsao":
      return sit.presente ? 3 : 5;
    case "alocada":
      return 6;
    case "aguardando":
    case "atrasada":
    case "confirmada":
      return 7;
    default:
      return 8;
  }
}

const posicaoDe = (sit: Situacao) => (sit.tipo === "posicao" ? sit.posicao : Number.POSITIVE_INFINITY);

/** Os atendimentos do dia na ordem da aba: o primeiro é o bilhete; na fila em casa, a menor posição primeiro. */
export function ordenarDoDia<T extends { sit: Situacao }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => peso(a.sit) - peso(b.sit) || posicaoDe(a.sit) - posicaoDe(b.sit));
}

export type Bilhete = { faixa: string; senha: string | null; botao: "qr" | "confirmar" | null };

/** O bilhete: a faixa com o que fazer, a senha (se já tem) e o botão da situação. */
export function bilheteDo(en: { senha: string | null; itemEstado: string | null }, sit: Situacao): Bilhete {
  const emCasa = en.itemEstado === "remoto";
  const qr = emCasa ? ("qr" as const) : null;
  switch (sit.tipo) {
    case "venha":
      return { faixa: "venha agora!", senha: en.senha, botao: qr };
    case "recepcao":
      return { faixa: "mostre na recepção", senha: en.senha, botao: null };
    case "posicao":
    case "sem_previsao":
      return sit.presente
        ? { faixa: "você está na unidade", senha: en.senha, botao: null }
        : { faixa: "você está na fila", senha: en.senha, botao: qr };
    case "alocada":
      return { faixa: "confirme a sua data", senha: null, botao: "confirmar" };
    case "atrasada":
      return { faixa: "a fila vai abrir", senha: en.senha, botao: null };
    default:
      return { faixa: "a fila ainda não abriu", senha: en.senha, botao: null };
  }
}

/** A linha de "também hoje": o quadro com a posição (quando há) e uma frase curta. */
export function linhaDo(sit: Situacao): { quadro: string | null; frase: string } {
  switch (sit.tipo) {
    case "posicao":
      return {
        quadro: `${sit.posicao}º`,
        frase: sit.posicao <= 1 || sit.minutos <= 0 ? "você é o próximo" : `cerca de ${sit.minutos} min`,
      };
    case "venha":
      return { quadro: null, frase: "venha agora" };
    case "recepcao":
      return { quadro: null, frase: "mostre na recepção" };
    case "sem_previsao":
      return { quadro: null, frase: "sem previsão agora" };
    case "alocada":
      return { quadro: null, frase: "confirme a sua data" };
    default:
      return { quadro: null, frase: "a fila ainda não abriu" };
  }
}

/** O número nas abas de baixo: em "atendimentos", os de outros dias e os sem data (o de hoje já está em "hoje"). */
export function contagemDasAbas(lista: { resumo: { grupo: string } }[]): { atendimentos?: number } {
  const atendimentos = lista.filter((x) => x.resumo.grupo === "proximos" || x.resumo.grupo === "sem_data").length;
  return atendimentos > 0 ? { atendimentos } : {};
}
