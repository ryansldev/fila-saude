import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Filters } from "@/components/ui/filters";
import { Search } from "@/components/ui/search";

afterEach(cleanup);

describe("Filtros (pílulas de escolha do design system)", () => {
  const options = [
    { id: "todas", label: "Todas", detail: "6" },
    { id: "s1", label: "Clínico geral", detail: "4" },
    { id: "s2", label: "Odontologia", detail: "cancelled", disabled: true },
  ];

  it("a escolhida fica marcada; tocar outra avisa com o id; desativada não", () => {
    const change = vi.fn();
    render(<Filters label="Serviço" options={options} current="todas" change={change} />);
    // Rádios nativos: teclado (setas) e leitor de tela vêm de graça.
    expect((screen.getByRole("radio", { name: /Todas/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Clínico geral/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: /Odontologia/ }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Clínico geral/ }));
    expect(change).toHaveBeenCalledWith("s1");
    fireEvent.click(screen.getByRole("radio", { name: /Odontologia/ }));
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("o detalhe fica ao lado do rótulo, sem '·' no texto", () => {
    render(<Filters label="Serviço" options={options} current="todas" change={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Serviço" }).textContent).not.toContain("·");
  });
});

describe("Busca (campo do design system)", () => {
  it("digitar avisa; com texto, 'Limpar busca' e Esc limpam", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Search label="Buscar" placeholder="Nome, senha ou CPF" value="" onChange={onChange} />,
    );
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar" }), { target: { value: "ana" } });
    expect(onChange).toHaveBeenLastCalledWith("ana");
    rerender(<Search label="Buscar" placeholder="Nome, senha ou CPF" value="ana" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    onChange.mockClear();
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Buscar" }), { key: "Escape" });
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
