import { describe, expect, it } from "vitest";
import { alternarOpcao, classificar } from "../src/questionario.ts";
import type { Alarme } from "../src/tipos.ts";
import { problemaNovo, respostas } from "./fixtures.ts";

describe("classificação de risco (RN-RISCO)", () => {
  it("RN-RISCO-01: qualquer sinal de alarme da Tela 1 é emergência", () => {
    const alarmes: Alarme[] = [
      "falta_de_ar",
      "dor_no_peito",
      "desmaio",
      "fraqueza_de_um_lado",
      "sangramento",
      "convulsao",
    ];
    for (const alarme of alarmes) {
      expect(classificar(respostas({ alarmes: [alarme] }), 30).nivel, alarme).toBe("emergencia");
    }
    expect(classificar(respostas({ alarmes: [] }), 30).nivel).toBe("rotina");
    expect(classificar(respostas({ alarmes: ["autolesao", "dor_no_peito"] }), 30).nivel).toBe("emergencia");
  });

  it("autolesão é urgente com apoio, e só ela", () => {
    expect(classificar(respostas({ alarmes: ["autolesao"] }), 30)).toMatchObject({
      nivel: "urgente",
      apoio: true,
    });
    expect(classificar(problemaNovo("forte"), 30).apoio).toBe(false);
  });

  it("urgente: problema novo forte, ou gestante com novo moderado", () => {
    expect(classificar(problemaNovo("forte"), 30).nivel).toBe("urgente");
    expect(classificar(problemaNovo("moderado", { grupos: ["gestante"] }), 30).nivel).toBe("urgente");
  });

  it("atenção: novo moderado, novo com condição, gestante com novo leve", () => {
    expect(classificar(problemaNovo("moderado"), 30).nivel).toBe("atencao");
    expect(classificar(problemaNovo("leve", { condicoes: ["diabetes"] }), 30).nivel).toBe("atencao");
    expect(classificar(problemaNovo("leve", { grupos: ["gestante"] }), 30).nivel).toBe("atencao");
  });

  it("rotina: todo o resto, mesmo com condição quando não é problema novo", () => {
    expect(classificar(problemaNovo("leve"), 30).nivel).toBe("rotina");
    expect(classificar(respostas({ motivo: "acompanhamento", condicoes: ["diabetes"] }), 70).nivel).toBe("rotina");
    expect(classificar(respostas({ motivo: "receita" }), 30).nivel).toBe("rotina");
  });

  it("a regra que bateu vem junto do nível", () => {
    expect(classificar(problemaNovo("forte"), 30).regra).toBe("Problema novo forte");
  });

  it("limite de idade abaixo de 2 anos: 1 é atenção, 2 é rotina", () => {
    expect(classificar(problemaNovo("leve"), 1).nivel).toBe("atencao");
    expect(classificar(problemaNovo("leve"), 0).nivel).toBe("atencao");
    expect(classificar(problemaNovo("leve"), 2).nivel).toBe("rotina");
  });

  it("limite de idade a partir de 60 anos: 59 é rotina, 60 é atenção", () => {
    expect(classificar(problemaNovo("leve"), 59).nivel).toBe("rotina");
    expect(classificar(problemaNovo("leve"), 60).nivel).toBe("atencao");
  });

  it("a idade só pesa em problema novo", () => {
    expect(classificar(respostas({ motivo: "exame" }), 1).nivel).toBe("rotina");
    expect(classificar(respostas({ motivo: "receita" }), 80).nivel).toBe("rotina");
  });
});

describe("opções exclusivas do questionário", () => {
  it("'nenhuma' é exclusiva: marcá-la desmarca as outras e vice-versa", () => {
    expect(alternarOpcao(["diabetes", "asma"], "nenhuma", "nenhuma")).toEqual(["nenhuma"]);
    expect(alternarOpcao(["nenhuma"], "diabetes", "nenhuma")).toEqual(["diabetes"]);
    expect(alternarOpcao(["diabetes"], "asma", "nenhuma")).toEqual(["diabetes", "asma"]);
    expect(alternarOpcao(["diabetes", "asma"], "diabetes", "nenhuma")).toEqual(["asma"]);
  });

  it("não altera a lista recebida", () => {
    const marcadas = Object.freeze(["diabetes"]) as string[];
    expect(alternarOpcao(marcadas, "asma", "nenhuma")).toEqual(["diabetes", "asma"]);
    expect(marcadas).toEqual(["diabetes"]);
  });
});
