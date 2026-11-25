import type { StationOperation } from "@fila-saude/schemas/queue";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StationPanel } from "@/components/station/station-panel";
import { ApiError } from "@/lib/api";
import { calledPhase, closeConfirm, closedText, closingFromError, oldestPill, waitText } from "@/lib/station";

afterEach(cleanup);

const NOW = Date.parse("2026-11-16T13:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

function operation(partial: Partial<StationOperation> = {}): StationOperation {
  return {
    station: { id: "e1", name: "Triagem 1", stage: "triage", closedAt: null, closing: null },
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
    timeZone: "America/Sao_Paulo",
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

  it("estação fechada: desde quando, na hora da unidade", () => {
    expect(closedText("Triagem 1", "2026-11-16T18:10:00Z", "America/Sao_Paulo")).toBe(
      "Triagem 1 fechou às 15:10. Não chama mais nesta sessão.",
    );
  });

  it("fechar: a confirmação diz o que acontece com a fila (RN-EST-07)", () => {
    expect(closeConfirm("Sala 2", null)).toMatchObject({ title: "Fechar Sala 2?", action: "Fechar" });
    const session = closeConfirm("Sala 1", "closes_session");
    expect(session).toMatchObject({ title: "Fechar Sala 1 e encerrar a sessão?", action: "Fechar e encerrar" });
    expect(session.description).toMatch(/última estação aberta do atendimento/);
    expect(session.description).toMatch(/remanejad/);
    const stage = closeConfirm("Acolhimento", "closes_stage");
    expect(stage).toMatchObject({ title: "Fechar Acolhimento e a triagem de hoje?", action: "Fechar a triagem" });
    expect(stage.description).toMatch(/não aceita gente nova até a triagem reabrir/);
  });

  it("a recusa por ser a última aberta vira o 'closing' da próxima confirmação (outra estação fechou antes)", () => {
    expect(closingFromError(new ApiError(409, "closes_session"))).toBe("closes_session");
    expect(closingFromError(new ApiError(409, "closes_stage"))).toBe("closes_stage");
    expect(closingFromError(new ApiError(409, "station_has_call"))).toBeNull();
    expect(closingFromError(new Error("rede"))).toBeNull();
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
    const care = operation({
      station: { id: "a1", name: "Consultório 1", stage: "care", closedAt: null, closing: null },
    });
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

  it("RN-EST-07: fechada, o quadro diz desde quando e Reabrir; não chama", () => {
    const sent: string[] = [];
    render(
      <StationPanel
        op={operation({
          called: null,
          station: { id: "e1", name: "Consultório 2", stage: "care", closedAt: "2026-11-16T18:10:00Z", closing: null },
        })}
        {...props}
        onCommand={(c) => sent.push(c)}
      />,
    );
    expect(screen.getByText("Estação fechada")).toBeDefined();
    expect(screen.getByText("Consultório 2 fechou às 15:10. Não chama mais nesta sessão.")).toBeDefined();
    expect(screen.queryByText("Chamar o próximo")).toBeNull();
    screen.getByText("Reabrir").click();
    expect(sent).toEqual(["reopen"]);
  });
});
