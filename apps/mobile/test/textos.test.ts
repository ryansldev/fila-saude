import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import { ErroDaApi } from "@/lib/api";
import { avisoDoErro, mensagemDoErro, situacaoDaEntrada } from "@/lib/textos";

const base: MinhaEntrada = {
  entradaId: "00000000-0000-4000-8000-000000000001",
  pessoa: "Ana",
  estado: "na_fila",
  servico: "Clínico",
  unidade: "UBS Centro",
  sessao: null,
  senha: "C-001",
  itemEstado: "remoto",
  estimativa: null,
  chamada: null,
  pendencias: [],
};

describe("minha fila: estado de cada entrada, como no design do app", () => {
  it("posição em casa e na unidade; venha agora; sua vez com a sala", () => {
    expect(situacaoDaEntrada({ ...base, estimativa: { tipo: "posicao", posicao: 4, minutos: 12 } })).toEqual({
      tipo: "posicao",
      posicao: 4,
      minutos: 12,
      presente: false,
    });
    expect(
      situacaoDaEntrada({ ...base, itemEstado: "presente", estimativa: { tipo: "posicao", posicao: 2, minutos: 5 } }),
    ).toMatchObject({ tipo: "posicao", presente: true });
    expect(situacaoDaEntrada({ ...base, estimativa: { tipo: "venha_agora" } })).toEqual({ tipo: "venha" });
    expect(
      situacaoDaEntrada({
        ...base,
        itemEstado: "chamado",
        estimativa: { tipo: "chamado" },
        chamada: { estacao: "Sala 1", em: "2026-11-12T12:00:00.000Z" },
      }),
    ).toEqual({ tipo: "vez", senha: "C-001", estacao: "Sala 1" });
  });

  it("RN-FILA-05: QR recusado → passe na recepção, antes da posição", () => {
    expect(
      situacaoDaEntrada({ ...base, pendencias: ["conta"], estimativa: { tipo: "posicao", posicao: 3, minutos: 9 } }),
    ).toEqual({ tipo: "recepcao" });
  });

  it("antes de abrir, reserva e lista; depois, atendido, remanejado e saiu", () => {
    const sem = { ...base, senha: null, itemEstado: null };
    expect(situacaoDaEntrada({ ...sem, estado: "confirmada" }).tipo).toBe("confirmada");
    expect(situacaoDaEntrada({ ...sem, estado: "na_reserva" }).tipo).toBe("reserva");
    expect(situacaoDaEntrada({ ...sem, estado: "aguardando" }).tipo).toBe("lista");
    expect(situacaoDaEntrada({ ...base, estimativa: { tipo: "aguardando_inicio" } }).tipo).toBe("aguardando");
    expect(situacaoDaEntrada({ ...base, estado: "concluida", itemEstado: "atendido_na_etapa" }).tipo).toBe("concluida");
    expect(situacaoDaEntrada({ ...base, estado: "remanejada", itemEstado: "remanejado" }).tipo).toBe("remanejada");
    expect(situacaoDaEntrada({ ...base, estado: "encerrada_sem_atendimento", itemEstado: "saiu_da_fila" }).tipo).toBe(
      "saiu",
    );
  });

  it("mensagens de erro em minúsculas, como o resto do app", () => {
    expect(mensagemDoErro(new ErroDaApi(409, "duplicada"))).toBe("essa pessoa já está inscrita neste atendimento.");
    expect(mensagemDoErro(new ErroDaApi(0, "sem_conexao"))).toMatch(/^sem internet/);
    expect(mensagemDoErro(new Error("x"))).toBe("não deu certo. tente de novo.");
  });
});

describe("aviso de erro na minha fila", () => {
  it("'sem internet' só quando a rede falha; outro erro diz o que houve", () => {
    expect(avisoDoErro(new ErroDaApi(0, "sem_conexao"))).toEqual({
      titulo: "sem internet",
      texto: "a sua posição volta a aparecer quando a conexão voltar.",
    });
    expect(avisoDoErro(new ErroDaApi(401, "nao_autenticado"))).toEqual({
      titulo: "não deu para atualizar",
      texto: "sua sessão expirou. entre de novo.",
    });
  });
});
