import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Campo, Selecao, Texto } from "@/components/formulario";

afterEach(cleanup);

describe("kit de formulário (shadcn)", () => {
  it("a lista mostra o rótulo da opção escolhida, não o id; vazia mostra o placeholder", () => {
    const opcoes = [
      { valor: "u1", rotulo: "UBS Centro" },
      { valor: "u2", rotulo: "UBS Norte" },
    ];
    render(
      <Campo rotulo="Unidade">
        <Selecao valor="u2" aoMudar={() => {}} opcoes={opcoes} />
      </Campo>,
    );
    expect(screen.getByText("UBS Norte")).toBeDefined();
    expect(screen.queryByText("u2")).toBeNull();
    cleanup();
    render(<Selecao valor="" aoMudar={() => {}} opcoes={opcoes} placeholder="Escolha a unidade" />);
    expect(screen.getByText("Escolha a unidade")).toBeDefined();
  });

  it("rótulo ligado ao campo e erro marcado no campo", () => {
    render(
      <Campo rotulo="CEP" erro="CEP com 8 dígitos">
        <Texto valor="0100" aoMudar={() => {}} />
      </Campo>,
    );
    const campo = screen.getByLabelText("CEP");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("CEP com 8 dígitos")).toBeDefined();
  });
});
