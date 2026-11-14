import { describe, expect, it } from "vitest";
import { type ConfigSessao, mudarVisibilidade, validarSessao } from "../src/sessao-config.ts";
import { congelar } from "./fixtures.ts";

const BASE: ConfigSessao = congelar({
  vagas: 10,
  visibilidade: "publica",
  dispensaPreCadastro: false,
  profissional: null,
  estacoes: ["e1"],
});
const LIVRE = congelar({ modo: "livre" as const, estacoesDoServico: ["e1", "e2"] });
const REGULADO = congelar({ modo: "regulado" as const, estacoesDoServico: ["e1", "e2"] });

describe("validarSessao", () => {
  it("INV-02: vagas 0 recusado, 1 aceito, nulo aceito", () => {
    expect(validarSessao(LIVRE, { ...BASE, vagas: 0 })).toEqual({
      ok: false,
      erro: "entrada_invalida",
      campos: { vagas: expect.any(String) },
    });
    expect(validarSessao(LIVRE, { ...BASE, vagas: 1.5 }).ok).toBe(false);
    expect(validarSessao(LIVRE, { ...BASE, vagas: 1 })).toEqual({ ok: true });
    expect(validarSessao(LIVRE, { ...BASE, vagas: null })).toEqual({ ok: true });
  });

  it("AD-016: dispensa só em pública", () => {
    expect(validarSessao(LIVRE, { ...BASE, dispensaPreCadastro: true })).toEqual({ ok: true });
    expect(validarSessao(LIVRE, { ...BASE, visibilidade: "privada", dispensaPreCadastro: true })).toEqual({
      ok: false,
      erro: "entrada_invalida",
      campos: { dispensaPreCadastro: expect.any(String) },
    });
  });

  it("RN-ENC-05: serviço regulado não tem sessão pública", () => {
    expect(validarSessao(REGULADO, BASE)).toEqual({ ok: false, erro: "servico_regulado" });
    expect(validarSessao(REGULADO, { ...BASE, visibilidade: "privada" })).toEqual({ ok: true });
  });

  it("AD-038: estações só as que atendem o serviço", () => {
    expect(validarSessao(LIVRE, { ...BASE, estacoes: ["e1", "e2"] })).toEqual({ ok: true });
    expect(validarSessao(LIVRE, { ...BASE, estacoes: ["e1", "e9"] })).toEqual({
      ok: false,
      erro: "entrada_invalida",
      campos: { estacoes: expect.any(String) },
    });
  });
});

describe("mudarVisibilidade", () => {
  it("RN-PUB-03: pública vira privada e perde a dispensa", () => {
    const c = congelar({ ...BASE, dispensaPreCadastro: true });
    const r = mudarVisibilidade(c, "privada", "livre");
    expect(r.ok && r.estado).toEqual({ ...BASE, visibilidade: "privada", dispensaPreCadastro: false });
    expect(c.dispensaPreCadastro).toBe(true);
  });

  it("RN-PUB-03: privada não vira pública em serviço regulado", () => {
    const c = congelar({ ...BASE, visibilidade: "privada" as const });
    expect(mudarVisibilidade(c, "publica", "regulado")).toEqual({ ok: false, erro: "servico_regulado" });
    const r = mudarVisibilidade(c, "publica", "livre");
    expect(r.ok && r.estado).toEqual({ ...BASE, visibilidade: "publica" });
  });
});

describe("validarSessao: estações que chamam (revisão 2026-11-13)", () => {
  const COM_ETAPAS = congelar({
    modo: "livre" as const,
    estacoesDoServico: ["t1", "a1"],
    exigeTriagem: true,
    etapas: { t1: "triagem" as const, a1: "atendimento" as const },
  });

  it("sem estação de atendimento (ou de triagem, se o serviço exige) ninguém seria chamado", () => {
    expect(validarSessao(COM_ETAPAS, { ...BASE, estacoes: [] })).toMatchObject({ ok: false, erro: "entrada_invalida" });
    expect(validarSessao(COM_ETAPAS, { ...BASE, estacoes: ["a1"] })).toEqual({
      ok: false,
      erro: "entrada_invalida",
      campos: { estacoes: "inclua uma estação de triagem: o serviço exige triagem" },
    });
    expect(validarSessao(COM_ETAPAS, { ...BASE, estacoes: ["t1"] }).ok).toBe(false);
    expect(validarSessao(COM_ETAPAS, { ...BASE, estacoes: ["t1", "a1"] })).toEqual({ ok: true });
  });

  it("estação repetida é recusada", () => {
    expect(validarSessao(LIVRE, { ...BASE, estacoes: ["e1", "e1"] })).toEqual({
      ok: false,
      erro: "entrada_invalida",
      campos: { estacoes: "estação repetida" },
    });
  });
});
