import { describe, expect, it } from "vitest";
import { OCUPACOES, papeisDe, podeCadastrar, problemasDaEquipe } from "../src/equipe.ts";

const U1 = "u1";
const U2 = "u2";

describe("equipe (ocupação, funções e papéis)", () => {
  it("ocupação vira papel de permissão na unidade; função de gestão também", () => {
    expect(
      papeisDe({
        vinculos: [
          { unidadeId: U1, ocupacao: "enfermeiro" },
          { unidadeId: U2, ocupacao: "medico" },
        ],
        funcoes: [
          { funcao: "gerente_ubs", unidadeId: U1 },
          { funcao: "gestao_sms", unidadeId: null },
        ],
      }),
    ).toEqual([
      { perfil: "enfermeiro", unidadeId: U1 },
      { perfil: "atendimento", unidadeId: U2 },
      { perfil: "gerente_ubs", unidadeId: U1 },
      { perfil: "gestao_sms", unidadeId: null },
    ]);
  });

  it("ACS e auxiliar de saúde bucal entram na equipe sem ação no painel por enquanto", () => {
    expect(OCUPACOES.acs.papeis).toEqual([]);
    expect(papeisDe({ vinculos: [{ unidadeId: U1, ocupacao: "acs" }], funcoes: [] })).toEqual([]);
  });

  it("escopo: SMS e regulação são do município; gerente e agendar, de uma unidade; ninguém sem atribuição", () => {
    expect(problemasDaEquipe({ vinculos: [], funcoes: [] })).toEqual({ _: "Informe ao menos uma ocupação ou função." });
    expect(problemasDaEquipe({ vinculos: [], funcoes: [{ funcao: "gerente_ubs", unidadeId: null }] })).toEqual({
      "funcoes.0.unidadeId": "Escolha a unidade.",
    });
    expect(problemasDaEquipe({ vinculos: [], funcoes: [{ funcao: "gestao_sms", unidadeId: U1 }] })).toEqual({
      "funcoes.0.unidadeId": "Função do município, sem unidade.",
    });
    expect(problemasDaEquipe({ vinculos: [{ unidadeId: U1, ocupacao: "recepcao" }], funcoes: [] })).toEqual({});
  });

  it("RN-PERF-04: SMS cadastra qualquer pessoa", () => {
    const sms = { vinculos: [], funcoes: [{ funcao: "gestao_sms" as const, unidadeId: null }] };
    expect(podeCadastrar(sms, { vinculos: [], funcoes: [{ funcao: "gerente_ubs", unidadeId: U2 }] })).toBe(true);
  });

  it("RN-PERF-04: gerente cadastra só a equipe da própria unidade, sem função de gestão", () => {
    const gerente = { vinculos: [], funcoes: [{ funcao: "gerente_ubs" as const, unidadeId: U1 }] };
    const tecnica = { vinculos: [{ unidadeId: U1, ocupacao: "tecnico_enfermagem" as const }], funcoes: [] };
    expect(podeCadastrar(gerente, tecnica)).toBe(true);
    expect(podeCadastrar(gerente, { ...tecnica, funcoes: [{ funcao: "agendar", unidadeId: U1 }] })).toBe(true);
    expect(podeCadastrar(gerente, { vinculos: [{ unidadeId: U2, ocupacao: "medico" }], funcoes: [] })).toBe(false);
    expect(podeCadastrar(gerente, { vinculos: [], funcoes: [{ funcao: "gerente_ubs", unidadeId: U1 }] })).toBe(false);
    expect(podeCadastrar(gerente, { vinculos: [], funcoes: [{ funcao: "regulacao_sms", unidadeId: null }] })).toBe(
      false,
    );
  });

  it("RN-PERF-04: quem não é SMS nem gerente não cadastra ninguém", () => {
    const enfermeira = { vinculos: [{ unidadeId: U1, ocupacao: "enfermeiro" as const }], funcoes: [] };
    expect(podeCadastrar(enfermeira, { vinculos: [{ unidadeId: U1, ocupacao: "acs" }], funcoes: [] })).toBe(false);
  });
});
