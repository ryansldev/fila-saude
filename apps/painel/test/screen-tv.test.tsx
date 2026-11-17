import type { TvState } from "@fila-saude/schemas/tv";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TvPanel } from "@/components/tv/tv-panel";

afterEach(cleanup);

const NOW = new Date(2026, 10, 16, 9, 42).getTime();

const state: Extract<TvState, { state: "paired" }> = {
  state: "paired",
  unit: { id: "11111111-1111-4111-8111-111111111111", name: "UBS Centro" },
  highlightSeconds: 10,
  calls: [],
  services: [
    { name: "Clínico geral", waiting: 3, onTheWay: 5 },
    { name: "Curativos", waiting: 0, onTheWay: 2 },
  ],
  qr: null,
  careStarted: true,
};
const last = [{ id: "a", ticket: "C-001", destination: "Triagem 1" }];

describe("TV branca (PainelDaTv)", () => {
  it("topo com a marca, a unidade e a hora", () => {
    render(<TvPanel state={state} current={null} last={last} svg={null} now={NOW} />);
    expect(screen.getByText("fila saúde")).toBeDefined();
    expect(screen.getByText("UBS Centro")).toBeDefined();
    expect(screen.getByText("09:42")).toBeDefined();
  });

  it("sem chamada: aguarde a sua senha; sem QR: o aviso", () => {
    render(<TvPanel state={state} current={null} last={last} svg={null} now={NOW} />);
    expect(screen.getByText("aguarde a sua senha")).toBeDefined();
    expect(screen.getByText("a senha aparece aqui quando chamarem")).toBeDefined();
    expect(screen.getByText("o QR aparece quando o atendimento abrir")).toBeDefined();
  });

  it("chamando: o cartão azul cheio com a senha e o destino", () => {
    render(
      <TvPanel
        state={state}
        current={{ id: "b", ticket: "C-012", destination: "Consultório 3" }}
        last={last}
        svg={null}
        now={NOW}
      />,
    );
    const call = screen.getByRole("region", { name: "chamando agora" });
    expect(call.className).toContain("bg-[var(--ds-action)]");
    expect(within(call).getByText("C-012")).toBeDefined();
    expect(within(call).getByText("consultório 3")).toBeDefined();
  });

  it("serviços com números separados, sem '+N a caminho'", () => {
    render(<TvPanel state={state} current={null} last={last} svg={null} now={NOW} />);
    const service = screen.getByRole("listitem", { name: "clínico geral" });
    expect(within(service).getByText("3")).toBeDefined();
    expect(within(service).getByText("5")).toBeDefined();
    expect(within(service).getByText("aguardando")).toBeDefined();
    expect(within(service).getByText("a caminho")).toBeDefined();
    expect(screen.queryByText(/\+\d/)).toBeNull();
  });
});
