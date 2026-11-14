import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import { ErroDaApi } from "@/lib/api";
import { avisoDoErro, mensagemDoErro, situacaoDaEntrada } from "@/lib/textos";

const sit = (e: MinhaEntrada) => situacaoDaEntrada(e, 0);

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
  saiaDeCasa: false,
};

describe("minha fila: estado de cada entrada, como no design do app", () => {
  it("posição em casa e na unidade; venha agora; sua vez com a sala", () => {
    expect(sit({ ...base, estimativa: { tipo: "posicao", posicao: 4, minutos: 12 } })).toEqual({
      tipo: "posicao",
      posicao: 4,
      minutos: 12,
      presente: false,
      sair: false,
    });
    // Já recebeu o push "hora de sair de casa": a tela diz o mesmo.
    expect(sit({ ...base, saiaDeCasa: true, estimativa: { tipo: "posicao", posicao: 4, minutos: 12 } })).toMatchObject({
      sair: true,
    });
    expect(
      sit({ ...base, itemEstado: "presente", estimativa: { tipo: "posicao", posicao: 2, minutos: 5 } }),
    ).toMatchObject({ tipo: "posicao", presente: true });
    expect(sit({ ...base, estimativa: { tipo: "venha_agora" } })).toEqual({ tipo: "venha" });
    expect(
      sit({
        ...base,
        itemEstado: "chamado",
        estimativa: { tipo: "chamado" },
        chamada: { estacao: "Sala 1", em: "2026-11-12T12:00:00.000Z" },
      }),
    ).toEqual({ tipo: "vez", senha: "C-001", estacao: "Sala 1" });
  });

  it("RN-FILA-05: QR recusado → passe na recepção, antes da posição", () => {
    expect(sit({ ...base, pendencias: ["conta"], estimativa: { tipo: "posicao", posicao: 3, minutos: 9 } })).toEqual({
      tipo: "recepcao",
    });
  });

  it("antes de abrir, reserva e lista; depois, atendido, remanejado e saiu", () => {
    const sem = { ...base, senha: null, itemEstado: null };
    expect(sit({ ...sem, estado: "confirmada" }).tipo).toBe("confirmada");
    expect(sit({ ...sem, estado: "na_reserva" }).tipo).toBe("reserva");
    expect(sit({ ...sem, estado: "aguardando" }).tipo).toBe("lista");
    const planejada = {
      id: base.entradaId,
      inicio: "2026-11-13T10:00:00.000Z",
      fim: "2026-11-13T20:00:00.000Z",
      estado: "planejada",
    };
    expect(sit({ ...base, sessao: planejada, estimativa: { tipo: "aguardando_inicio" } }).tipo).toBe("aguardando");
    expect(sit({ ...base, estado: "concluida", itemEstado: "atendido_na_etapa" }).tipo).toBe("concluida");
    expect(sit({ ...base, estado: "remanejada", itemEstado: "remanejado" }).tipo).toBe("remanejada");
    expect(sit({ ...base, estado: "encerrada_sem_atendimento", itemEstado: "saiu_da_fila" }).tipo).toBe("saiu");
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

describe("estados que não podem mentir para o paciente (revisão 2026-11-13)", () => {
  const AGORA = Date.parse("2026-11-13T12:00:00.000Z"); // 9h em Brasília
  const sessao = (inicio: string, estado = "planejada") => ({
    id: "00000000-0000-4000-8000-000000000009",
    inicio,
    fim: "2026-11-13T20:00:00.000Z",
    estado,
  });
  const confirmada = { ...base, estado: "confirmada", senha: null, itemEstado: null };

  it("confirmada antes do início: a fila começa às 7h; depois do início, sem abrir: a unidade ainda não abriu", () => {
    expect(situacaoDaEntrada({ ...confirmada, sessao: sessao("2026-11-13T13:00:00.000Z") }, AGORA).tipo).toBe(
      "confirmada",
    );
    expect(situacaoDaEntrada({ ...confirmada, sessao: sessao("2026-11-13T10:00:00.000Z") }, AGORA).tipo).toBe(
      "atrasada",
    );
  });

  it("cancelada (pelo paciente, agendador ou recepção) nunca vira 'você foi chamado e não apareceu'", () => {
    expect(situacaoDaEntrada({ ...base, estado: "cancelada", itemEstado: "saiu_da_fila" }, AGORA).tipo).toBe(
      "cancelada",
    );
    expect(situacaoDaEntrada({ ...base, estado: "arquivada", itemEstado: null }, AGORA).tipo).toBe("cancelada");
  });

  it("fila aberta sem previsão não diz 'aguardando início'; modo manual tem tela própria", () => {
    const aberta = { ...base, sessao: sessao("2026-11-13T10:00:00.000Z", "aberta") };
    expect(
      situacaoDaEntrada({ ...aberta, itemEstado: "presente", estimativa: { tipo: "aguardando_inicio" } }, AGORA),
    ).toEqual({ tipo: "sem_previsao", presente: true });
    expect(situacaoDaEntrada({ ...aberta, estimativa: { tipo: "modo_manual" } }, AGORA)).toEqual({
      tipo: "sem_previsao",
      presente: false,
    });
    expect(
      situacaoDaEntrada(
        { ...base, sessao: sessao("2026-11-13T13:00:00.000Z"), estimativa: { tipo: "aguardando_inicio" } },
        AGORA,
      ).tipo,
    ).toBe("aguardando");
  });

  it("alocada mostra a data marcada; chamado sem sala ainda é a vez", () => {
    expect(
      situacaoDaEntrada(
        { ...base, estado: "alocada", senha: null, itemEstado: null, sessao: sessao("2026-11-20T13:00:00.000Z") },
        AGORA,
      ).tipo,
    ).toBe("alocada");
    expect(situacaoDaEntrada({ ...base, itemEstado: "chamado", chamada: null }, AGORA)).toEqual({
      tipo: "vez",
      senha: "C-001",
      estacao: null,
    });
  });
});
