import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import { ErroDaApi } from "@/lib/api";
import { mensagemDoErro, situacaoDaEntrada } from "@/lib/textos";

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

describe("textos da tela da vez (T3.4)", () => {
  it("posição e tempo; venha agora; sua vez com a sala", () => {
    expect(situacaoDaEntrada({ ...base, estimativa: { tipo: "posicao", posicao: 4, minutos: 12 } })).toEqual({
      destaque: "normal",
      titulo: "Você é o 4º da fila",
      detalhe: "Cerca de 12 min",
    });
    expect(situacaoDaEntrada({ ...base, estimativa: { tipo: "venha_agora" } }).destaque).toBe("venha");
    expect(
      situacaoDaEntrada({
        ...base,
        itemEstado: "chamado",
        estimativa: { tipo: "chamado" },
        chamada: { estacao: "Sala 1", em: "2026-11-12T12:00:00.000Z" },
      }),
    ).toEqual({ destaque: "vez", titulo: "É a sua vez!", detalhe: "Vá para Sala 1 com a senha C-001" });
  });

  it("RN-FILA-05: QR recusado por pendência → passe na recepção", () => {
    expect(situacaoDaEntrada({ ...base, pendencias: ["conta"] })).toMatchObject({
      destaque: "venha",
      titulo: "Passe na recepção",
    });
  });

  it("antes de abrir, confirmada e reserva; depois, atendido e remanejado", () => {
    expect(situacaoDaEntrada({ ...base, estado: "confirmada", senha: null, itemEstado: null }).titulo).toBe(
      "Inscrição confirmada",
    );
    expect(situacaoDaEntrada({ ...base, estado: "na_reserva", senha: null, itemEstado: null }).titulo).toBe(
      "Você está na reserva",
    );
    expect(situacaoDaEntrada({ ...base, estado: "concluida", itemEstado: "atendido_na_etapa" }).titulo).toBe(
      "Atendimento concluído",
    );
    expect(situacaoDaEntrada({ ...base, estado: "remanejada", itemEstado: "remanejado" }).titulo).toBe(
      "Sua vez não chegou hoje",
    );
  });

  it("mensagens de erro da inscrição", () => {
    expect(mensagemDoErro(new ErroDaApi(409, "duplicada"))).toMatch(/já está/);
    expect(mensagemDoErro(new ErroDaApi(0, "sem_conexao"))).toMatch(/conexão/);
    expect(mensagemDoErro(new Error("x"))).toMatch(/Tente de novo/);
  });
});
