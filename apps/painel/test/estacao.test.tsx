import type { OperacaoEstacao } from "@fila-saude/schemas/fila";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PainelDaEstacao } from "@/components/estacao/painel-da-estacao";
import { faseDoChamado, pilulaDoMaisAntigo, textoDaEspera } from "@/lib/estacao";

afterEach(cleanup);

const AGORA = Date.parse("2026-11-16T13:00:00Z");
const ha = (min: number) => new Date(AGORA - min * 60_000).toISOString();

function operacao(parcial: Partial<OperacaoEstacao> = {}): OperacaoEstacao {
  return {
    estacao: { id: "e1", nome: "Triagem 1", etapa: "triagem" },
    sessao: { id: "s1", servico: "Clínico geral", estado: "aberta" },
    chamado: {
      itemId: "i1",
      senha: "C-001",
      nome: "Bruno Lima",
      etapa: "triagem",
      pulos: 0,
      chamadoEm: ha(1),
      toleranciaEsgotada: false,
      compareceuEm: null,
      prioridade: ["idoso"],
      triagem: { riscoSugerido: "urgente", regra: "problema novo forte", apoio: false, prioridade: ["idoso"] },
    },
    aguardando: 1,
    remotos: 1,
    toleranciaMin: 5,
    aviso: null,
    proximos: [{ senha: "C-002", nome: "Ana", presenteDesde: ha(12) }],
    aCaminho: [{ senha: "C-003", nome: "Carla" }],
    maisAntigo: { presenteDesde: ha(12), tempoAlvoMin: 30 },
    agora: new Date(AGORA).toISOString(),
    ...parcial,
  };
}

const props = { cor: null, aoEscolherCor: () => {}, aoComando: () => {}, enviando: false, agora: AGORA };

describe("lib/estacao", () => {
  it("fase do chamado pelo Compareceu", () => {
    expect(faseDoChamado({ compareceuEm: null })).toBe("chamado");
    expect(faseDoChamado({ compareceuEm: ha(1) })).toBe("na_sala");
  });

  it("pílula do mais antigo: atrasada só depois do tempo-alvo", () => {
    expect(pilulaDoMaisAntigo(null, AGORA)).toBeNull();
    expect(pilulaDoMaisAntigo({ presenteDesde: ha(12), tempoAlvoMin: 30 }, AGORA)).toEqual({
      texto: "o mais antigo há 12 min",
      atrasado: false,
    });
    expect(pilulaDoMaisAntigo({ presenteDesde: ha(31), tempoAlvoMin: 30 }, AGORA)?.atrasado).toBe(true);
    expect(pilulaDoMaisAntigo({ presenteDesde: ha(0), tempoAlvoMin: 30 }, AGORA)?.texto).toBe("o mais antigo chegou agora");
    expect(pilulaDoMaisAntigo({ presenteDesde: ha(30), tempoAlvoMin: 30 }, AGORA)?.atrasado).toBe(false);
  });

  it("texto da espera", () => {
    expect(textoDaEspera(ha(12), AGORA)).toBe("há 12 min");
    expect(textoDaEspera(new Date(AGORA - 20_000).toISOString(), AGORA)).toBe("agora");
  });
});

describe("PainelDaEstacao", () => {
  it("fase 1: Rechamar, Não compareceu e Compareceu; a classificação espera", () => {
    render(<PainelDaEstacao op={operacao()} {...props} />);
    const nomes = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(nomes.slice(0, 3)).toEqual(["Rechamar", "Não compareceu", "Compareceu"]);
    expect(screen.getByText(/A classificação de risco abre quando a pessoa entrar na sala/)).toBeDefined();
    expect(screen.queryByText("Classifique o risco")).toBeNull();
    expect(screen.getByText("60 anos ou mais")).toBeDefined();
    expect(screen.getByText("o mais antigo há 12 min")).toBeDefined();
  });

  it("fase 2: na sua sala, desfazer, a classificação e Finalizar e chamar o próximo", () => {
    const op = operacao();
    render(
      <PainelDaEstacao op={{ ...op, chamado: op.chamado && { ...op.chamado, compareceuEm: ha(1) } }} {...props} />,
    );
    expect(screen.getAllByText(/na sua sala/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "desfazer" })).toBeDefined();
    expect(screen.getByText("Classifique o risco")).toBeDefined();
    expect(screen.getByText("app sugeriu")).toBeDefined();
    expect(screen.getByRole("button", { name: /Finalizar e chamar o próximo/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Rechamar" })).toBeNull();
  });

  it("fila vazia: ninguém ainda e ninguém a caminho", () => {
    render(
      <PainelDaEstacao
        op={operacao({ chamado: null, aguardando: 0, remotos: 0, proximos: [], aCaminho: [], maisAntigo: null })}
        {...props}
      />,
    );
    expect(screen.getByText("ninguém ainda")).toBeDefined();
    expect(screen.getByText("ninguém")).toBeDefined();
    expect(screen.getByText("Ninguém aguardando agora")).toBeDefined();
  });
});
