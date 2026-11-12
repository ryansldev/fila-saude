import { condicoesNaUnidade, permitido } from "infra/painel/guard";
import { describe, expect, it } from "vitest";

const U1 = "u1";
const U2 = "u2";

describe("guard pela matriz", () => {
  it("RN-PERF-01: admin passa na ação de configurar na própria unidade; não na outra", async () => {
    const admin = [{ perfil: "admin" as const, unidadeId: U1 }];
    expect(await permitido(admin, "configurar_servicos_sessoes_estacoes_tv", U1)).toBe(true);
    expect(await permitido(admin, "configurar_servicos_sessoes_estacoes_tv", U2)).toBe(false);
  });

  it("profissional em configurar → negado; gestor passa na gestão em qualquer unidade", async () => {
    expect(
      await permitido([{ perfil: "profissional", unidadeId: U1 }], "configurar_servicos_sessoes_estacoes_tv", U1),
    ).toBe(false);
    expect(await permitido([{ perfil: "gestor", unidadeId: null }], "criar_unidades_regras_usuarios", U2)).toBe(true);
  });

  it("ação sem unidade só conta perfil de escopo município", () => {
    expect(
      condicoesNaUnidade([{ perfil: "admin", unidadeId: U1 }], "configurar_servicos_sessoes_estacoes_tv", null),
    ).toBeNull();
    expect(condicoesNaUnidade([{ perfil: "gestor", unidadeId: null }], "criar_unidades_regras_usuarios", null)).toBe(
      "livre",
    );
  });

  it("perfis acumulados somam", async () => {
    const perfis = [
      { perfil: "profissional" as const, unidadeId: U1 },
      { perfil: "admin" as const, unidadeId: U1 },
    ];
    expect(await permitido(perfis, "configurar_servicos_sessoes_estacoes_tv", U1)).toBe(true);
  });

  it("P1: profissional em operar_chamadas sem a ressalva conferida → negado; conferida → passa", async () => {
    const prof = [{ perfil: "profissional" as const, unidadeId: U1 }];
    expect(await permitido(prof, "operar_chamadas", U1)).toBe(false);
    expect(await permitido(prof, "operar_chamadas", U1, { atendimento: () => false })).toBe(false);
    expect(await permitido(prof, "operar_chamadas", U1, { atendimento: async () => true })).toBe(true);
  });

  it("P1: recepção em ver_resposta_risco_de_vida sem conferência → negado", async () => {
    expect(await permitido([{ perfil: "recepcao", unidadeId: U1 }], "ver_resposta_risco_de_vida", U1)).toBe(false);
  });
});
