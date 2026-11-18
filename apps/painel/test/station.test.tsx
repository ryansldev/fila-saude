import type { StationOperation } from "@fila-saude/schemas/queue";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StationPanel } from "@/components/station/station-panel";
import { calledPhase, oldestPill, waitText } from "@/lib/station";

afterEach(cleanup);

const NOW = Date.parse("2026-11-16T13:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

function operation(partial: Partial<StationOperation> = {}): StationOperation {
  return {
    station: { id: "e1", name: "Triagem 1", stage: "triage" },
    session: { id: "s1", service: "Clínico geral", state: "open" },
    called: {
      itemId: "i1",
      ticket: "C-001",
      name: "Bruno Lima",
      stage: "triage",
      skips: 0,
      calledAt: ago(1),
      toleranceExceeded: false,
      showedUpAt: null,
      priority: ["elderly"],
      triage: { suggestedRisk: "urgent", rule: "problema novo forte", support: false },
    },
    waiting: 1,
    remote: 1,
    toleranceMin: 5,
    notice: null,
    upcoming: [{ ticket: "C-002", name: "Ana", presentSince: ago(12) }],
    onTheWay: [{ ticket: "C-003", name: "Carla" }],
    oldest: { presentSince: ago(12), targetTimeMin: 30 },
    now: new Date(NOW).toISOString(),
    classifies: true,
    ...partial,
  };
}

const props = { color: null, onChooseColor: () => {}, onCommand: () => {}, sending: false, now: NOW };

describe("lib/estacao", () => {
  it("fase do chamado pelo Compareceu", () => {
    expect(calledPhase({ showedUpAt: null })).toBe("called");
    expect(calledPhase({ showedUpAt: ago(1) })).toBe("in_room");
  });

  it("pílula do mais antigo: atrasada só depois do tempo-alvo", () => {
    expect(oldestPill(null, NOW)).toBeNull();
    expect(oldestPill({ presentSince: ago(12), targetTimeMin: 30 }, NOW)).toEqual({
      text: "o mais antigo há 12 min",
      late: false,
    });
    expect(oldestPill({ presentSince: ago(31), targetTimeMin: 30 }, NOW)?.late).toBe(true);
    expect(oldestPill({ presentSince: ago(0), targetTimeMin: 30 }, NOW)?.text).toBe("o mais antigo chegou agora");
    expect(oldestPill({ presentSince: ago(30), targetTimeMin: 30 }, NOW)?.late).toBe(false);
  });

  it("texto da espera", () => {
    expect(waitText(ago(12), NOW)).toBe("há 12 min");
    expect(waitText(new Date(NOW - 20_000).toISOString(), NOW)).toBe("agora");
  });
});

describe("PainelDaEstacao", () => {
  it("fase 1: Rechamar, Não compareceu e Compareceu; a classificação espera", () => {
    render(<StationPanel op={operation()} {...props} />);
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(names.slice(0, 3)).toEqual(["Rechamar", "Não compareceu", "Compareceu"]);
    expect(screen.getByText(/A classificação de risco abre quando a pessoa entrar na sala/)).toBeDefined();
    expect(screen.queryByText("Classifique o risco")).toBeNull();
    expect(screen.getByText("60 anos ou mais")).toBeDefined();
    expect(screen.getByText("o mais antigo há 12 min")).toBeDefined();
  });

  it("fase 2: na sua sala, desfazer, a classificação e Finalizar e chamar o próximo", () => {
    const op = operation();
    render(<StationPanel op={{ ...op, called: op.called && { ...op.called, showedUpAt: ago(1) } }} {...props} />);
    expect(screen.getAllByText(/na sua sala/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "desfazer" })).toBeDefined();
    expect(screen.getByText("Classifique o risco")).toBeDefined();
    expect(screen.getByText("app sugeriu")).toBeDefined();
    expect(screen.getByRole("button", { name: /Finalizar e chamar o próximo/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Rechamar" })).toBeNull();
  });

  // `triage: null` tira a ficha (o chamado chega sem ela); sem o argumento, fica a do operation().
  const inRoom = (o: StationOperation, triage?: NonNullable<StationOperation["called"]>["triage"] | null) => {
    const called = o.called && { ...o.called, showedUpAt: ago(1) };
    if (called && triage === null) delete called.triage;
    else if (called && triage) called.triage = triage;
    return { ...o, called };
  };
  const finishing = () => screen.getByRole("button", { name: /Finalizar e chamar o próximo/ }) as HTMLButtonElement;

  it("RN-PERF-05: o técnico não vê as cores e finaliza o acolhimento sem cor", () => {
    render(<StationPanel op={{ ...inRoom(operation()), classifies: false }} {...props} />);
    expect(screen.queryByText("Classifique o risco")).toBeNull();
    const done = screen.getByRole("button", { name: /^Finalizar acolhimento$/ }) as HTMLButtonElement;
    expect(done.disabled).toBe(false);
  });

  it("H3: na triagem, sem cor não finaliza; com cor, finaliza", () => {
    const { rerender } = render(<StationPanel op={inRoom(operation())} {...props} />);
    expect(finishing().disabled).toBe(true);
    rerender(<StationPanel op={inRoom(operation())} {...props} color="attention" />);
    expect(finishing().disabled).toBe(false);
  });

  it("sem a ficha da triagem as cores aparecem do mesmo jeito (a API exige a cor)", () => {
    render(<StationPanel op={inRoom(operation(), null)} {...props} />);
    expect(screen.getByText("Classifique o risco")).toBeDefined();
    expect(screen.queryByText("app sugeriu")).toBeNull();
    expect(finishing().disabled).toBe(true);
  });

  it("AD-059: encaminhar e o aviso do 1º lugar só com vermelho", () => {
    const { rerender } = render(<StationPanel op={inRoom(operation())} {...props} color="urgent" />);
    expect(screen.queryByRole("button", { name: /Encaminhar à emergência/ })).toBeNull();
    rerender(<StationPanel op={inRoom(operation())} {...props} color="emergency" />);
    expect(screen.getByRole("button", { name: /Encaminhar à emergência/ })).toBeDefined();
    expect(screen.getByText(/1º lugar do atendimento/)).toBeDefined();
  });

  it("RN-RISCO-06: o apoio (autolesão) aparece na triagem; a sala de atendimento não classifica", () => {
    const o = operation();
    const support = inRoom(o, o.called?.triage && { ...o.called.triage, support: true });
    const { rerender } = render(<StationPanel op={support} {...props} />);
    expect(screen.getAllByText(/188/).length).toBeGreaterThan(0);
    const care = operation({ station: { id: "a1", name: "Consultório 1", stage: "care" } });
    rerender(
      <StationPanel
        op={inRoom({ ...care, called: care.called && { ...care.called, stage: "care" } }, null)}
        {...props}
      />,
    );
    expect(screen.queryByText("Classifique o risco")).toBeNull();
    expect(finishing().disabled).toBe(false);
  });

  it("fila vazia: ninguém ainda e ninguém a caminho", () => {
    render(
      <StationPanel
        op={operation({ called: null, waiting: 0, remote: 0, upcoming: [], onTheWay: [], oldest: null })}
        {...props}
      />,
    );
    expect(screen.getByText("ninguém ainda")).toBeDefined();
    expect(screen.getByText("ninguém")).toBeDefined();
    expect(screen.getByText("Ninguém aguardando agora")).toBeDefined();
  });
});
