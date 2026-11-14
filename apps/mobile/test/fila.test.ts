import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import { destaqueDaFila, passosDaFila } from "@/lib/fila";
import { situacaoDaEntrada } from "@/lib/textos";

const base: MinhaEntrada = {
  entradaId: "00000000-0000-4000-8000-000000000001",
  pessoa: "Bruno",
  estado: "na_fila",
  servico: "Curativos",
  unidade: "UBS Centro",
  sessao: {
    id: "00000000-0000-4000-8000-000000000002",
    inicio: "2026-11-14T11:00:00.000Z",
    fim: "2026-11-14T15:00:00.000Z",
    estado: "aberta",
  },
  senha: "V-002",
  itemEstado: "remoto",
  estimativa: { tipo: "posicao", posicao: 3, minutos: 20 },
  chamada: null,
  pendencias: [],
  saiaDeCasa: false,
  servicoId: "00000000-0000-4000-8000-0000000000aa",
  paraMim: true,
  nascimento: "1992-08-15",
  podeCancelar: true,
  etapa: "atendimento",
  triado: false,
  encaminhado: false,
};
const SESSAO_PLANEJADA = {
  id: "00000000-0000-4000-8000-000000000002",
  inicio: "2026-11-14T13:00:00.000Z",
  fim: "2026-11-14T15:00:00.000Z",
  estado: "planejada",
};
const AGORA = Date.parse("2026-11-14T12:00:00.000Z");
const passos = (en: MinhaEntrada) => passosDaFila(en, situacaoDaEntrada(en, AGORA)).map((p) => `${p.id}:${p.estado}`);
const destaque = (en: MinhaEntrada) => destaqueDaFila(en, situacaoDaEntrada(en, AGORA));

describe("tela da fila: linha do tempo", () => {
  it("sem triagem: inscrição, em casa, na unidade, atendimento; em casa é a etapa de agora", () => {
    expect(passos(base)).toEqual(["inscricao:feito", "casa:atual", "unidade:futuro", "atendimento:futuro"]);
  });

  it("na unidade e chamado na sala", () => {
    const presente = {
      ...base,
      itemEstado: "presente" as const,
      estimativa: { tipo: "posicao" as const, posicao: 1, minutos: 0 },
    };
    expect(passos(presente)).toEqual(["inscricao:feito", "casa:feito", "unidade:atual", "atendimento:futuro"]);
    const vez = {
      ...base,
      itemEstado: "chamado" as const,
      chamada: { estacao: "Sala 1", em: base.sessao?.inicio ?? "" },
    };
    expect(passos(vez)).toEqual(["inscricao:feito", "casa:feito", "unidade:feito", "atendimento:atual"]);
  });

  it("com triagem: a triagem aparece; depois dela, o atendimento é a etapa de agora (mesmo em casa)", () => {
    const naTriagem = { ...base, etapa: "triagem" as const, itemEstado: "presente" as const };
    expect(passos(naTriagem)).toEqual([
      "inscricao:feito",
      "casa:feito",
      "unidade:atual",
      "triagem:futuro",
      "atendimento:futuro",
    ]);
    const chamadoNaTriagem = {
      ...naTriagem,
      itemEstado: "chamado" as const,
      chamada: { estacao: "Triagem 1", em: "" },
    };
    expect(passos(chamadoNaTriagem)[3]).toBe("triagem:atual");
    const triadoEmCasa = { ...base, triado: true };
    expect(passos(triadoEmCasa)).toEqual([
      "inscricao:feito",
      "casa:feito",
      "unidade:feito",
      "triagem:feito",
      "atendimento:atual",
    ]);
  });

  it("antes da fila abrir, 'em casa' é a de agora mas ainda não começou; atendido completa tudo", () => {
    const inscrito = {
      ...base,
      estado: "confirmada",
      senha: null,
      itemEstado: null,
      estimativa: null,
      sessao: SESSAO_PLANEJADA,
    };
    expect(passos(inscrito)).toEqual(["inscricao:feito", "casa:pendente", "unidade:futuro", "atendimento:futuro"]);
    const atendido = { ...base, estado: "concluida", itemEstado: "atendido_na_etapa" as const };
    expect(passos(atendido).every((p) => p.endsWith(":feito"))).toBe(true);
  });

  it("encerrado sem atendimento (cancelado, saiu, encaminhado) não tem linha do tempo", () => {
    expect(passos({ ...base, estado: "cancelada", itemEstado: null })).toEqual([]);
    expect(passos({ ...base, estado: "concluida", itemEstado: "atendido_na_etapa", encaminhado: true })).toEqual([]);
  });
});

describe("tela da fila: o destaque (senha grande)", () => {
  it("na fila: senha, posição e tempo", () => {
    expect(destaque(base)).toEqual({ tom: "azul", rotulo: "sua senha", senha: "V-002", posicao: 3, minutos: 20 });
  });

  it("é a sua vez: verde, com a sala", () => {
    const vez = { ...base, itemEstado: "chamado" as const, chamada: { estacao: "Sala 1", em: "" } };
    expect(destaque(vez)).toEqual({ tom: "verde", rotulo: "é a sua vez!", senha: "V-002", sala: "sala 1" });
  });

  it("venha agora e recepção: amarelo", () => {
    expect(destaque({ ...base, estimativa: { tipo: "venha_agora" } })).toMatchObject({
      tom: "amarelo",
      rotulo: "venha agora",
    });
    expect(destaque({ ...base, pendencias: ["conta"] })).toMatchObject({
      tom: "amarelo",
      rotulo: "mostre na recepção",
    });
  });

  it("sem senha ainda: diz quando ela sai", () => {
    const inscrito = {
      ...base,
      estado: "confirmada",
      senha: null,
      itemEstado: null,
      estimativa: null,
      sessao: SESSAO_PLANEJADA,
    };
    expect(destaque(inscrito)).toEqual({ tom: "cinza", rotulo: "a senha sai quando a fila abrir", senha: null });
  });
});
