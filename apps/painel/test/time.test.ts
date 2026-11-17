import { unitInputSchema } from "@fila-saude/schemas/unit";
import { describe, expect, it } from "vitest";
import { validateClient } from "@/lib/forms/errors";
import { addInterval, DAYS, DEFAULT_TIME, intervalKey, timeProblems, timeSummary } from "@/lib/forms/time";

describe("horário de funcionamento", () => {
  it("padrão: segunda a sexta, 07:00–17:00; os dias vão de domingo (0) a sábado (6)", () => {
    expect(DAYS.map((d) => d.key)).toEqual(["1", "2", "3", "4", "5", "6", "0"]);
    expect(DEFAULT_TIME["1"]).toEqual([{ opens: "07:00", closes: "17:00" }]);
    expect(DEFAULT_TIME["0"]).toBeUndefined();
  });

  it("novo intervalo começa depois do último do dia", () => {
    const h = addInterval({ "1": [{ opens: "07:00", closes: "12:00" }] }, "1");
    expect(h["1"]).toEqual([
      { opens: "07:00", closes: "12:00" },
      { opens: "13:00", closes: "17:00" },
    ]);
    expect(addInterval({}, "6")["6"]).toEqual([{ opens: "07:00", closes: "12:00" }]);
  });

  it("fim antes do início e intervalos sobrepostos aparecem no intervalo certo", () => {
    expect(timeProblems({ "1": [{ opens: "12:00", closes: "08:00" }] })).toEqual({
      "time.1.0": "O fim deve ser depois do início.",
    });
    expect(
      timeProblems({
        "2": [
          { opens: "07:00", closes: "12:00" },
          { opens: "11:00", closes: "17:00" },
        ],
      }),
    ).toEqual({ "time.2.1": "Sobrepõe outro intervalo do dia." });
    expect(timeProblems(DEFAULT_TIME)).toEqual({});
  });

  it("resumo legível agrupa dias iguais", () => {
    expect(timeSummary(DEFAULT_TIME)).toBe("Seg a Sex 07:00–17:00");
    expect(
      timeSummary({
        ...DEFAULT_TIME,
        "6": [{ opens: "08:00", closes: "12:00" }],
      }),
    ).toBe("Seg a Sex 07:00–17:00 · Sáb 08:00–12:00");
    expect(timeSummary({})).toBe("Sem horário definido");
  });
});

describe("chave do erro de um intervalo", () => {
  it("é a mesma que a validação da unidade (e a API) devolve", () => {
    const e = validateClient(unitInputSchema, { time: { "1": [{ opens: "8:00", closes: "17:00" }] } });
    expect(Object.keys(e?.fields ?? {})).toContain(intervalKey("1", 0));
  });
});
