import type { MinhaEntrada, ServicoDaUnidade } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import { envioDaInscricao, modoDaInscricao, podeRefazer, servicosComLista } from "@/lib/inscricoes";
import { proximoPasso, situacaoDaEntrada } from "@/lib/textos";

const SRV = "00000000-0000-4000-8000-0000000000aa";
const minha = (x: Partial<MinhaEntrada>): MinhaEntrada => ({
  entradaId: "00000000-0000-4000-8000-000000000001",
  pessoa: "Ana",
  estado: "aguardando",
  servico: "Clínico",
  unidade: "UBS Centro",
  sessao: null,
  senha: null,
  itemEstado: null,
  estimativa: null,
  chamada: null,
  pendencias: [],
  saiaDeCasa: false,
  prazoConfirmacao: null,
  servicoId: SRV,
  paraMim: true,
  nascimento: "1990-01-01",
  podeCancelar: true,
  etapa: null,
  triado: false,
  encaminhado: false,
  ...x,
});

describe("lista de espera no app (fatia 4)", () => {
  it("a tela de inscrição tem três modos pelo caminho: sessão, lista e refazer", () => {
    expect(modoDaInscricao("lista")).toBe("lista");
    expect(modoDaInscricao("refazer")).toBe("refazer");
    expect(modoDaInscricao("00000000-0000-4000-8000-000000000009")).toBe("sessao");
  });

  it("cada modo envia para a sua rota; só a sessão confere antes ('/verificar')", () => {
    const ids = { sessaoId: "s1", servicoId: "v1", entradaId: "e1" };
    expect(envioDaInscricao("sessao", "exemplo", ids)).toEqual({
      enviar: "/v1/municipios/exemplo/sessoes/s1/inscricoes",
      verificar: "/v1/municipios/exemplo/sessoes/s1/inscricoes/verificar",
    });
    expect(envioDaInscricao("lista", "exemplo", ids)).toEqual({
      enviar: "/v1/municipios/exemplo/servicos/v1/entradas",
      verificar: null,
    });
    expect(envioDaInscricao("refazer", "exemplo", ids)).toEqual({
      enviar: "/v1/municipios/exemplo/entradas/e1/questionario",
      verificar: null,
    });
  });

  it("I1/I2: serviços da unidade; regulado e requisição explicam, quem já está na lista vê isso", () => {
    const servicos: ServicoDaUnidade[] = [
      { id: SRV, nome: "Clínico", modo: "livre" },
      { id: "00000000-0000-4000-8000-0000000000bb", nome: "Dentista", modo: "livre" },
      { id: "00000000-0000-4000-8000-0000000000cc", nome: "Raio-X", modo: "requisicao" },
      { id: "00000000-0000-4000-8000-0000000000dd", nome: "Cardiologia", modo: "regulado" },
    ];
    expect(servicosComLista(servicos, [minha({})]).map((s) => [s.nome, s.tipo])).toEqual([
      ["Clínico", "na_lista"],
      ["Dentista", "entrar"],
      ["Raio-X", "requisicao"],
      ["Cardiologia", "regulado"],
    ]);
    // Quem foi para outra pessoa não impede "para mim".
    expect(servicosComLista(servicos, [minha({ paraMim: false })])[0]?.tipo).toBe("entrar");
  });

  it("RN-CONF-01: alocada diz até quando confirmar", () => {
    const e = minha({
      estado: "alocada",
      sessao: { id: "s", inicio: "2026-11-20T11:00:00.000Z", fim: "2026-11-20T15:00:00.000Z", estado: "planejada" },
      prazoConfirmacao: "2026-11-18T11:00:00.000Z",
    });
    expect(proximoPasso(e, situacaoDaEntrada(e, 0), 0)).toBe("confirme até quarta, 18/11, às 8h.");
  });

  it("I9: refazer o questionário só na lista (aguardando, alocada, confirmada antes do dia)", () => {
    expect(podeRefazer(minha({ estado: "aguardando" }))).toBe(true);
    expect(podeRefazer(minha({ estado: "alocada" }))).toBe(true);
    expect(podeRefazer(minha({ estado: "confirmada" }))).toBe(true);
    expect(podeRefazer(minha({ estado: "na_fila" }))).toBe(false);
    expect(podeRefazer(minha({ estado: "na_reserva" }))).toBe(false);
  });
});
