import { describe, expect, it } from "vitest";
import { euPainelSchema } from "../auth.ts";
import { estacaoEdicaoSchema, estacaoSchema } from "../estacao.ts";
import { servicoEdicaoSchema, servicoSchema } from "../servico.ts";
import { sessaoEdicaoSchema, sessaoSchema, visibilidadeEntradaSchema } from "../sessao.ts";
import { configEfetivaSchema, unidadeEdicaoSchema, unidadeSchema } from "../unidade.ts";
import { perfisEntradaSchema, usuarioPainelSchema } from "../usuario.ts";

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;
const id = "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f";

describe("euPainelSchema", () => {
  it("euPainelSchema aceita perfis com e sem unidade e recusa perfil paciente", () => {
    const eu = {
      id: "u1",
      nome: "Ana",
      login: "ana",
      perfis: [
        { perfil: "gestor", unidadeId: null },
        { perfil: "recepcao", unidadeId: id },
      ],
    };
    expect(ok(euPainelSchema, eu)).toBe(true);
    expect(ok(euPainelSchema, { ...eu, perfis: [{ perfil: "paciente", unidadeId: null }] })).toBe(false);
  });
});

describe("contratos da configuração da v0.1", () => {
  it("edição de sessão sem versao é recusada", () => {
    expect(ok(sessaoEdicaoSchema, { vagas: 3 })).toBe(false);
    expect(ok(sessaoEdicaoSchema, { vagas: 3, versao: 0 })).toBe(true);
    expect(ok(sessaoEdicaoSchema, { vagas: 0, versao: 0 })).toBe(false);
  });
  it("visibilidade exige versao", () => {
    expect(ok(visibilidadeEntradaSchema, { visibilidade: "privada" })).toBe(false);
    expect(ok(visibilidadeEntradaSchema, { visibilidade: "privada", versao: 2 })).toBe(true);
  });
  it("config da unidade aceita null para voltar a herdar", () => {
    expect(ok(unidadeEdicaoSchema, { config: { janelaK: null } })).toBe(true);
    expect(ok(unidadeEdicaoSchema, { nome: "UBS 2" })).toBe(true);
    expect(ok(unidadeEdicaoSchema, { config: { janelaK: 0 } })).toBe(false);
  });
  it("estacaoEdicaoSchema não aceita etapa", () => {
    expect(ok(estacaoEdicaoSchema, { nome: "C1" })).toBe(true);
    expect(ok(estacaoEdicaoSchema, { nome: "C1", etapa: "triagem" })).toBe(false);
  });
  it("servicoEdicaoSchema parcial", () => {
    expect(ok(servicoEdicaoSchema, { modo: "regulado" })).toBe(true);
    expect(ok(servicoEdicaoSchema, { prefixo: "ABCD" })).toBe(false);
  });
  it("perfisEntradaSchema exige ao menos um", () => {
    expect(ok(perfisEntradaSchema, { perfis: [] })).toBe(false);
    expect(ok(perfisEntradaSchema, { perfis: [{ perfil: "admin", unidadeId: id }] })).toBe(true);
  });
  it("um caso válido de cada saída", () => {
    expect(
      ok(unidadeSchema, {
        id,
        nome: "UBS",
        tipo: "ubs",
        endereco: "Rua",
        lat: 0,
        lng: 0,
        fuso: "America/Sao_Paulo",
        horario: {},
        config: { janelaK: 3 },
      }),
    ).toBe(true);
    expect(ok(configEfetivaSchema, { valores: { janelaK: 3 }, origem: { janelaK: "unidade" } })).toBe(true);
    expect(
      ok(servicoSchema, {
        id,
        unidadeId: id,
        nome: "Clínico",
        prefixo: "C",
        exigeTriagem: true,
        modo: "livre",
        tempoMedioMin: { triagem: 5, atendimento: 15 },
        ativo: true,
      }),
    ).toBe(true);
    expect(ok(estacaoSchema, { id, unidadeId: id, nome: "T1", etapa: "triagem", servicos: [id], aberta: false })).toBe(
      true,
    );
    expect(
      ok(sessaoSchema, {
        id,
        servicoId: id,
        inicio: "2026-11-12T11:00:00.000Z",
        fim: "2026-11-12T15:00:00.000Z",
        vagas: null,
        ocupadas: 0,
        visibilidade: "privada",
        dispensaPreCadastro: false,
        profissional: null,
        estacoes: [],
        estado: "planejada",
        versao: 0,
      }),
    ).toBe(true);
    expect(
      ok(usuarioPainelSchema, { id: "x", login: "ana", nome: "Ana", perfis: [{ perfil: "gestor", unidadeId: null }] }),
    ).toBe(true);
  });
});
