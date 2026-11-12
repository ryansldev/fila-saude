import { describe, expect, it } from "vitest";
import {
  adicionarIntervalo,
  DIAS,
  HORARIO_PADRAO,
  problemasDoHorario,
  resumoDoHorario,
} from "@/lib/formularios/horario";

describe("horário de funcionamento", () => {
  it("padrão: segunda a sexta, 07:00–17:00; os dias vão de domingo (0) a sábado (6)", () => {
    expect(DIAS.map((d) => d.chave)).toEqual(["1", "2", "3", "4", "5", "6", "0"]);
    expect(HORARIO_PADRAO["1"]).toEqual([{ abre: "07:00", fecha: "17:00" }]);
    expect(HORARIO_PADRAO["0"]).toBeUndefined();
  });

  it("novo intervalo começa depois do último do dia", () => {
    const h = adicionarIntervalo({ "1": [{ abre: "07:00", fecha: "12:00" }] }, "1");
    expect(h["1"]).toEqual([
      { abre: "07:00", fecha: "12:00" },
      { abre: "13:00", fecha: "17:00" },
    ]);
    expect(adicionarIntervalo({}, "6")["6"]).toEqual([{ abre: "07:00", fecha: "12:00" }]);
  });

  it("fim antes do início e intervalos sobrepostos aparecem no intervalo certo", () => {
    expect(problemasDoHorario({ "1": [{ abre: "12:00", fecha: "08:00" }] })).toEqual({
      "horario.1.0": "O fim deve ser depois do início.",
    });
    expect(
      problemasDoHorario({
        "2": [
          { abre: "07:00", fecha: "12:00" },
          { abre: "11:00", fecha: "17:00" },
        ],
      }),
    ).toEqual({ "horario.2.1": "Sobrepõe outro intervalo do dia." });
    expect(problemasDoHorario(HORARIO_PADRAO)).toEqual({});
  });

  it("resumo legível agrupa dias iguais", () => {
    expect(resumoDoHorario(HORARIO_PADRAO)).toBe("Seg a Sex 07:00–17:00");
    expect(
      resumoDoHorario({
        ...HORARIO_PADRAO,
        "6": [{ abre: "08:00", fecha: "12:00" }],
      }),
    ).toBe("Seg a Sex 07:00–17:00 · Sáb 08:00–12:00");
    expect(resumoDoHorario({})).toBe("Sem horário definido");
  });
});
