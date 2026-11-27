import { describe, expect, it } from "vitest";
import { breaksError, fromBands, toBands } from "../src/bands.ts";

const H = 3_600_000;
const D = Date.UTC(2026, 10, 30);
const at = (h: number) => D + h * H;

describe("horário em faixas (RN-SES-06)", () => {
  it("uma faixa só é a sessão sem intervalo", () => {
    expect(fromBands([{ start: at(8), end: at(12) }])).toEqual({ ok: true, start: at(8), end: at(12), breaks: [] });
    expect(toBands(at(8), at(12), [])).toEqual([{ start: at(8), end: at(12) }]);
  });

  it("duas faixas: o vão entre elas é o intervalo, em qualquer ordem digitada", () => {
    const span = fromBands([
      { start: at(13), end: at(17) },
      { start: at(8), end: at(12) },
    ]);
    expect(span).toEqual({ ok: true, start: at(8), end: at(17), breaks: [{ start: at(12), end: at(13) }] });
    expect(toBands(at(8), at(17), [{ start: at(12), end: at(13) }])).toEqual([
      { start: at(8), end: at(12) },
      { start: at(13), end: at(17) },
    ]);
  });

  it("faixas que se sobrepõem ou se encostam são recusadas, e a faixa precisa terminar depois de começar", () => {
    const overlap = [
      { start: at(8), end: at(12) },
      { start: at(11), end: at(17) },
    ];
    expect(fromBands(overlap)).toEqual({ ok: false, error: "as faixas não podem se sobrepor" });
    const touching = [
      { start: at(8), end: at(12) },
      { start: at(12), end: at(17) },
    ];
    expect(fromBands(touching)).toEqual({ ok: false, error: "as faixas não podem se sobrepor" });
    expect(fromBands([{ start: at(12), end: at(8) }])).toEqual({ ok: false, error: "fim deve ser depois do início" });
    expect(fromBands([])).toEqual({ ok: false, error: "inclua um horário" });
  });

  it("o intervalo gravado fica dentro da sessão, em ordem e sem se sobrepor", () => {
    expect(breaksError(at(8), at(17), [{ start: at(12), end: at(13) }])).toBeNull();
    expect(breaksError(at(8), at(17), [{ start: at(7), end: at(9) }])).toBe(
      "o intervalo fica dentro do horário da sessão",
    );
    expect(breaksError(at(8), at(17), [{ start: at(8), end: at(9) }])).toBe(
      "o intervalo fica dentro do horário da sessão",
    );
    expect(breaksError(at(8), at(17), [{ start: at(13), end: at(12) }])).toBe("fim deve ser depois do início");
    expect(
      breaksError(at(8), at(17), [
        { start: at(12), end: at(14) },
        { start: at(13), end: at(15) },
      ]),
    ).toBe("as faixas não podem se sobrepor");
  });
});
