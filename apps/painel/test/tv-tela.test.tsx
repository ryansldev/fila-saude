import type { TvEstado } from "@fila-saude/schemas/tv";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PainelDaTv } from "@/components/tv/painel-da-tv";

afterEach(cleanup);

const AGORA = new Date(2026, 10, 16, 9, 42).getTime();

const estado: Extract<TvEstado, { estado: "pareada" }> = {
  estado: "pareada",
  unidade: { id: "11111111-1111-4111-8111-111111111111", nome: "UBS Centro" },
  destaqueSegundos: 10,
  chamadas: [],
  servicos: [
    { nome: "Clínico geral", aguardando: 3, aCaminho: 5 },
    { nome: "Curativos", aguardando: 0, aCaminho: 2 },
  ],
  qr: null,
  atendimentoIniciado: true,
};
const ultimas = [{ id: "a", senha: "C-001", destino: "Triagem 1" }];

describe("TV branca (PainelDaTv)", () => {
  it("topo com a marca, a unidade e a hora", () => {
    render(<PainelDaTv estado={estado} atual={null} ultimas={ultimas} svg={null} agora={AGORA} />);
    expect(screen.getByText("fila saúde")).toBeDefined();
    expect(screen.getByText("UBS Centro")).toBeDefined();
    expect(screen.getByText("09:42")).toBeDefined();
  });

  it("sem chamada: aguarde a sua senha; sem QR: o aviso", () => {
    render(<PainelDaTv estado={estado} atual={null} ultimas={ultimas} svg={null} agora={AGORA} />);
    expect(screen.getByText("aguarde a sua senha")).toBeDefined();
    expect(screen.getByText("a senha aparece aqui quando chamarem")).toBeDefined();
    expect(screen.getByText("o QR aparece quando o atendimento abrir")).toBeDefined();
  });

  it("chamando: o cartão azul cheio com a senha e o destino", () => {
    render(
      <PainelDaTv
        estado={estado}
        atual={{ id: "b", senha: "C-012", destino: "Consultório 3" }}
        ultimas={ultimas}
        svg={null}
        agora={AGORA}
      />,
    );
    const chamada = screen.getByRole("region", { name: "chamando agora" });
    expect(chamada.className).toContain("bg-[var(--ds-acao)]");
    expect(within(chamada).getByText("C-012")).toBeDefined();
    expect(within(chamada).getByText("consultório 3")).toBeDefined();
  });

  it("serviços com números separados, sem '+N a caminho'", () => {
    render(<PainelDaTv estado={estado} atual={null} ultimas={ultimas} svg={null} agora={AGORA} />);
    const servico = screen.getByRole("listitem", { name: "clínico geral" });
    expect(within(servico).getByText("3")).toBeDefined();
    expect(within(servico).getByText("5")).toBeDefined();
    expect(within(servico).getByText("aguardando")).toBeDefined();
    expect(within(servico).getByText("a caminho")).toBeDefined();
    expect(screen.queryByText(/\+\d/)).toBeNull();
  });
});
