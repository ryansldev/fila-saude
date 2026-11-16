import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

const classes = (el: HTMLElement) => el.className.split(/\s+/);

describe("Button do design system", () => {
  it("padrão: principal, tamanho padrão, nas classes do tokens.css", () => {
    render(<Button>Alocar</Button>);
    expect(classes(screen.getByRole("button", { name: "Alocar" }))).toEqual(
      expect.arrayContaining(["ds-btn", "ds-btn-principal", "ds-btn-padrao"]),
    );
  });

  it("variante e tamanho com os nomes do design system", () => {
    render(
      <Button variante="perigoContorno" tamanho="compacto">
        Recusou
      </Button>,
    );
    expect(classes(screen.getByRole("button", { name: "Recusou" }))).toEqual(
      expect.arrayContaining(["ds-btn-perigoContorno", "ds-btn-compacto"]),
    );
  });

  it("carregando: não aceita clique (nem dois), fica ocupado e diz 'Aguarde…'", () => {
    const clicar = vi.fn();
    render(
      <Button carregando onClick={clicar}>
        Alocar
      </Button>,
    );
    const b = screen.getByRole("button");
    fireEvent.click(b);
    fireEvent.click(b);
    expect(clicar).not.toHaveBeenCalled();
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.textContent).toContain("Aguarde…");
  });
});
