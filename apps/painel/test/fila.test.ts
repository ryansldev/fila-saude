import { describe, expect, it } from "vitest";
import { acoesDaFila, cronometro, ordenarFila, rotuloDoEstado } from "@/lib/fila";

const item = (senha: string, estado: string) => ({ senha, estado });

describe("fila do dia no painel (T3.4, T3.7)", () => {
  it("botões pela matriz e pela unidade do perfil (PD-38)", () => {
    const gerente = [{ perfil: "gerente_ubs" as const, unidadeId: "u1" }];
    const recepcao = [{ perfil: "recepcao" as const, unidadeId: "u1" }];
    expect(acoesDaFila(gerente, "u1", "planejada")).toEqual({ abrir: true, encerrar: false, presenca: false });
    expect(acoesDaFila(gerente, "u1", "aberta")).toEqual({ abrir: false, encerrar: true, presenca: false });
    expect(acoesDaFila(gerente, "u2", "planejada").abrir).toBe(false);
    expect(acoesDaFila(recepcao, "u1", "aberta")).toEqual({ abrir: false, encerrar: false, presenca: true });
    expect(acoesDaFila(recepcao, "u1", "planejada").presenca).toBe(false);
  });

  it("ordem da tela: chamado, na unidade, remotos, depois os que saíram; pela senha", () => {
    const ordem = ordenarFila([
      item("C-004", "atendido_na_etapa"),
      item("C-003", "remoto"),
      item("C-002", "presente"),
      item("C-001", "remoto"),
      item("C-005", "chamado"),
    ]).map((i) => i.senha);
    expect(ordem).toEqual(["C-005", "C-002", "C-001", "C-003", "C-004"]);
  });

  it("textos dos estados e o cronômetro da chamada (AD-006)", () => {
    expect(rotuloDoEstado("remoto")).toBe("A caminho");
    expect(rotuloDoEstado("presente")).toBe("Na unidade");
    expect(rotuloDoEstado("saiu_da_fila")).toBe("Saiu da fila");
    const em = "2026-11-12T12:00:00.000Z";
    expect(cronometro(em, Date.parse(em) + 65_000)).toBe("01:05");
    expect(cronometro(em, Date.parse(em) - 1000)).toBe("00:00");
  });
});
