import type { Classificacao, Respostas } from "./tipos.ts";

/** Questionário v1: vale a primeira regra que bater, de cima para baixo. */
export function classificar(respostas: Respostas, idadeAnos: number): Classificacao {
  const { alarmes, motivo, gravidade, condicoes, grupos } = respostas;
  const novo = motivo === "novo";
  const gestante = grupos.includes("gestante");

  if (alarmes.some((alarme) => alarme !== "autolesao")) {
    return { nivel: "emergencia", regra: "Sinal de alarme na Tela 1", apoio: false };
  }
  if (alarmes.includes("autolesao")) {
    return {
      nivel: "urgente",
      regra: "Pensamentos de tirar a própria vida ou de se machucar",
      apoio: true,
    };
  }
  if (novo && gravidade === "forte") {
    return { nivel: "urgente", regra: "Problema novo forte", apoio: false };
  }
  if (novo && gravidade === "moderado" && gestante) {
    return { nivel: "urgente", regra: "Gestante com problema novo moderado", apoio: false };
  }
  if (novo && gravidade === "moderado") {
    return { nivel: "atencao", regra: "Problema novo moderado", apoio: false };
  }
  if (novo && condicoes.length > 0) {
    return { nivel: "atencao", regra: "Problema novo com condição de saúde", apoio: false };
  }
  if (novo && (idadeAnos < 2 || idadeAnos >= 60)) {
    return {
      nivel: "atencao",
      regra: "Problema novo com idade abaixo de 2 ou a partir de 60",
      apoio: false,
    };
  }
  if (novo && gravidade === "leve" && gestante) {
    return { nivel: "atencao", regra: "Gestante com problema novo leve", apoio: false };
  }
  return { nivel: "rotina", regra: "Sem sinais de risco", apoio: false };
}

/**
 * Marca ou desmarca `opcao`. A opção `exclusiva` ("Nenhum destes", "Nenhuma") desmarca
 * todas as outras ao ser marcada, e é desmarcada quando outra é marcada. Não altera `marcadas`.
 */
export function alternarOpcao(marcadas: string[], opcao: string, exclusiva: string): string[] {
  if (marcadas.includes(opcao)) return marcadas.filter((m) => m !== opcao);
  if (opcao === exclusiva) return [exclusiva];
  return [...marcadas.filter((m) => m !== exclusiva), opcao];
}
