import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Busca } from "@/components/ui/busca";
import { Filtros } from "@/components/ui/filtros";

afterEach(cleanup);

describe("Filtros (pílulas de escolha do design system)", () => {
  const opcoes = [
    { id: "todas", rotulo: "Todas", detalhe: "6" },
    { id: "s1", rotulo: "Clínico geral", detalhe: "4" },
    { id: "s2", rotulo: "Odontologia", detalhe: "cancelada", desativada: true },
  ];

  it("a escolhida fica marcada; tocar outra avisa com o id; desativada não", () => {
    const mudar = vi.fn();
    render(<Filtros rotulo="Serviço" opcoes={opcoes} atual="todas" mudar={mudar} />);
    expect(screen.getByRole("radio", { name: /Todas/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Clínico geral/ }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("radio", { name: /Clínico geral/ }));
    expect(mudar).toHaveBeenCalledWith("s1");
    fireEvent.click(screen.getByRole("radio", { name: /Odontologia/ }));
    expect(mudar).toHaveBeenCalledTimes(1);
  });

  it("o detalhe fica ao lado do rótulo, sem '·' no texto", () => {
    render(<Filtros rotulo="Serviço" opcoes={opcoes} atual="todas" mudar={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Serviço" }).textContent).not.toContain("·");
  });
});

describe("Busca (campo do design system)", () => {
  it("digitar avisa; com texto, 'Limpar busca' e Esc limpam", () => {
    const aoMudar = vi.fn();
    const { rerender } = render(<Busca rotulo="Buscar" placeholder="Nome, senha ou CPF" valor="" aoMudar={aoMudar} />);
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar" }), { target: { value: "ana" } });
    expect(aoMudar).toHaveBeenLastCalledWith("ana");
    rerender(<Busca rotulo="Buscar" placeholder="Nome, senha ou CPF" valor="ana" aoMudar={aoMudar} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(aoMudar).toHaveBeenLastCalledWith("");
    aoMudar.mockClear();
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Buscar" }), { key: "Escape" });
    expect(aoMudar).toHaveBeenLastCalledWith("");
  });
});
