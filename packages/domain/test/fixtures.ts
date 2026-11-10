import type { Respostas } from "../src/tipos.ts";

/** Respostas "sem nada": motivo de rotina, sem alarmes, condições ou grupos. */
export function respostas(parcial: Partial<Respostas> = {}): Respostas {
  return {
    alarmes: [],
    motivo: "exame",
    gravidade: null,
    condicoes: [],
    grupos: [],
    ...parcial,
  };
}

/** Respostas de "problema novo" com a gravidade dada. */
export function problemaNovo(
  gravidade: NonNullable<Respostas["gravidade"]>,
  parcial: Partial<Respostas> = {},
): Respostas {
  return respostas({ motivo: "novo", gravidade, ...parcial });
}
