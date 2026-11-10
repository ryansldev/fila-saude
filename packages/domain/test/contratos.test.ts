import { describe, expect, it } from "vitest";
import {
  type EstadoEntrada,
  type EstadoItem,
  type EstadoSessao,
  TRANSICOES_ENTRADA,
  TRANSICOES_ITEM,
  TRANSICOES_SESSAO,
  transicionar,
} from "../src/contratos.ts";
import { lerTabelas, type Maquina } from "./specs-tabelas.ts";

const DADOS = {
  entrada: TRANSICOES_ENTRADA,
  item: TRANSICOES_ITEM,
  sessao: TRANSICOES_SESSAO,
} as const;

const tuplas = (linhas: { de: string; qualificador?: string | undefined; evento: string; para: string }[]) =>
  linhas.map((l) => [l.de, l.qualificador ?? "", l.evento, l.para].join(" | ")).sort();

describe("contratos", () => {
  for (const maquina of ["entrada", "item", "sessao"] as Maquina[]) {
    it(`contratos: toda linha das specs está nos dados (${maquina})`, () => {
      const dasSpecs = lerTabelas().filter((l) => l.maquina === maquina);
      expect(dasSpecs.length).toBeGreaterThan(0);
      expect(tuplas(DADOS[maquina])).toEqual(tuplas(dasSpecs));
    });

    it(`contratos: condição, efeitos e spec são os textos das specs (${maquina})`, () => {
      const dasSpecs = lerTabelas().filter((l) => l.maquina === maquina);
      const completo = (l: {
        de: string;
        qualificador?: string | undefined;
        evento: string;
        para: string;
        paraQualificador?: string | undefined;
        condicao: string;
        efeitos: string;
        spec: string;
      }) => [...tuplas([l]), l.paraQualificador ?? "", l.condicao, l.efeitos, l.spec].join(" ## ");
      expect(DADOS[maquina].map(completo).sort()).toEqual(dasSpecs.map(completo).sort());
    });
  }

  it("contratos: transição não listada é proibida", () => {
    expect(transicionar(TRANSICOES_ENTRADA, "concluida", "Paciente cancela")).toBeNull();
    expect(transicionar(TRANSICOES_ENTRADA, "alocada", "Evento inexistente")).toBeNull();
    expect(transicionar(TRANSICOES_ENTRADA, "confirmada", "Sessão abre")).toBe("na_fila");
    expect(transicionar(TRANSICOES_ITEM, "chamado", "Rechamar")).toBe("(mesmo)");
    expect(transicionar(TRANSICOES_SESSAO, "planejada", "Cancela")).toBe("cancelada");
  });

  it("contratos: estados finais não têm saída, exceto a reversão da contingência", () => {
    const saidas = <S extends string>(t: { de: S | "—"; evento: string; para: string }[], finais: S[]) =>
      t.filter((x) => (finais as string[]).includes(x.de)).map((x) => `${x.de} | ${x.evento} | ${x.para}`);
    const finaisEntrada: EstadoEntrada[] = ["concluida", "cancelada", "encerrada_sem_atendimento"];
    const finaisItem: EstadoItem[] = ["saiu_da_fila", "remanejado"];
    const finaisSessao: EstadoSessao[] = ["cancelada", "encerrada"];
    expect(saidas(TRANSICOES_ENTRADA, finaisEntrada)).toHaveLength(1);
    const reversao = TRANSICOES_ENTRADA.find((x) => x.de === "encerrada_sem_atendimento");
    expect(reversao?.para).toBe("remanejada");
    expect(reversao?.spec).toBe("contingencia");
    expect(saidas(TRANSICOES_ITEM, finaisItem)).toEqual([]);
    expect(saidas(TRANSICOES_SESSAO, finaisSessao)).toEqual([]);
  });
});
