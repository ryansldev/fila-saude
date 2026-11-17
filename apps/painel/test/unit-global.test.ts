import { describe, expect, it } from "vitest";
import { addressRows, initialUnit, summaryText } from "@/lib/current-unit";
import { panelMenu, profilesInUnit } from "@/lib/navigation";

describe("a unidade no menu, para o painel inteiro", () => {
  it("escolha inicial: a guardada se ainda valer; senão, a primeira; sem unidades, nenhuma", () => {
    expect(initialUnit("b", ["a", "b"])).toBe("b");
    expect(initialUnit("x", ["a", "b"])).toBe("a");
    expect(initialUnit(null, ["a"])).toBe("a");
    expect(initialUnit(null, [])).toBeNull();
  });

  it("o menu mostra só o que a pessoa pode fazer na unidade escolhida", () => {
    const profiles = [
      { profile: "reception" as const, unitId: "u1" },
      { profile: "scheduler" as const, unitId: "u2" },
    ];
    const labels = (u: string) => panelMenu(profilesInUnit(profiles, u)).map((i) => i.label);
    expect(labels("u1")).toEqual(["Fila do dia", "QR de entrada"]);
    expect(labels("u2")).toEqual(["Agendamento"]);
  });

  it("perfil do município (unidade nula) vale em toda unidade", () => {
    const profiles = [{ profile: "sms_management" as const, unitId: null }];
    expect(profilesInUnit(profiles, "u9")).toEqual(profiles);
    expect(profilesInUnit(profiles, null)).toEqual(profiles);
  });

  it("o que acontece hoje na unidade, em palavras", () => {
    const timeZone = "America/Sao_Paulo";
    expect(summaryText({ open: 2, nextOpening: null }, timeZone)).toBe("2 sessões abertas");
    expect(summaryText({ open: 1, nextOpening: "2026-11-16T16:00:00.000Z" }, timeZone)).toBe("1 sessão aberta");
    expect(summaryText({ open: 0, nextOpening: "2026-11-16T16:00:00.000Z" }, timeZone)).toBe("abre às 13:00");
    expect(summaryText({ open: 0, nextOpening: null }, timeZone)).toBe("nada hoje");
    expect(summaryText(undefined, timeZone)).toBeNull();
  });

  it("endereço em linhas, cada informação no seu lugar", () => {
    expect(
      addressRows({
        street: "Praça da Sé",
        number: "100",
        neighborhood: "Sé",
        postalCode: "01001-000",
        complement: "Bloco B",
      }),
    ).toEqual(["Praça da Sé, 100 (Bloco B)", "Sé", "CEP 01001-000"]);
    expect(
      addressRows({
        street: "Rua A",
        number: "1",
        neighborhood: "Centro",
        postalCode: "01001-000",
        complement: null,
      })[0],
    ).toBe("Rua A, 1");
  });

  it("o CEP sai com hífen (o banco guarda só os dígitos)", () => {
    expect(addressRows({ street: "Rua A", number: "1", neighborhood: "Centro", postalCode: "01310100" })[2]).toBe(
      "CEP 01310-100",
    );
  });
});
