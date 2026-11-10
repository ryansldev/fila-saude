import { CONFIG_PADRAO, type DiaSessao, type ItemFila } from "../src/fila.ts";
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

/** Congela em profundidade: qualquer mutação numa ação pura vira TypeError (módulos ES são estritos). */
export function congelar<T>(x: T): T {
  if (x !== null && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congelar(v);
  }
  return x;
}

/** Item remoto, sem pendência, rotina, sem prioridade. */
export function itemFila(id: string, numero: number, parcial: Partial<ItemFila> = {}): ItemFila {
  return {
    id,
    entradaId: `ent-${id}`,
    senha: `C${String(numero).padStart(3, "0")}`,
    numero,
    etapa: "atendimento",
    estado: "remoto",
    pendencias: [],
    urgenciaConfirmada: false,
    risco: "rotina",
    prioridade: { grupos: [], conferida: false, conferidaEm: null },
    pulos: 0,
    travadoAtras: [],
    saiuEm: null,
    atendidoEmEtapas: [],
    ...parcial,
  };
}

/**
 * Sessão aberta do serviço "cli" com uma estação "e1" de atendimento e os itens remotos,
 * numerados na ordem dada (RN-FILA-01). Volta congelado.
 */
export function diaCom(ids: string[], parcial: Partial<DiaSessao> = {}): DiaSessao {
  return congelar({
    sessaoId: "s1",
    servicoId: "cli",
    estado: "aberta",
    itens: ids.map((id, i) => itemFila(id, i + 1)),
    chamadas: [],
    estacoes: [{ id: "e1", etapa: "atendimento", servicos: ["cli"], aberta: true, chamadoItemId: null }],
    config: CONFIG_PADRAO,
    contingencias: [],
    proximoNumero: ids.length + 1,
    ...parcial,
  });
}

/** Cópia congelada com o item alterado (montagem de cenário, não regra de domínio). */
export function comItem(dia: DiaSessao, id: string, parcial: Partial<ItemFila>): DiaSessao {
  return congelar({ ...dia, itens: dia.itens.map((i) => (i.id === id ? { ...i, ...parcial } : i)) });
}

/**
 * Simula a chamada da Task 6 (chamarProximo) só no que a fila do dia observa:
 * o item vira "chamado", a chamada é registrada e as travas sobre ele acabam.
 */
export function chamar(dia: DiaSessao, id: string, em: number): DiaSessao {
  const item = dia.itens.find((i) => i.id === id);
  if (!item) throw new Error(`item ${id} não existe`);
  return congelar({
    ...dia,
    itens: dia.itens.map((i) =>
      i.id === id
        ? { ...i, estado: "chamado" as const, travadoAtras: [] }
        : { ...i, travadoAtras: i.travadoAtras.filter((t) => t !== id) },
    ),
    chamadas: [...dia.chamadas, { itemId: id, etapa: item.etapa, em }],
  });
}
