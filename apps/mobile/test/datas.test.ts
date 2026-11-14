import { describe, expect, it } from "vitest";
import { diaCurto, hora } from "@/lib/datas";

describe("datas como no design do app", () => {
  it("dia da semana e data curta, em minúsculas, no fuso da unidade", () => {
    expect(diaCurto("2026-11-12T11:00:00.000Z")).toBe("quinta, 12/11");
    expect(diaCurto("2026-11-13T02:30:00.000Z")).toBe("quinta, 12/11");
  });

  it("hora cheia sem minutos; com minutos, 7h30", () => {
    expect(hora("2026-11-12T10:00:00.000Z")).toBe("7h");
    expect(hora("2026-11-12T10:30:00.000Z")).toBe("7h30");
  });
});
