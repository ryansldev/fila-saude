import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormField, Selection, Text } from "@/components/form";

afterEach(cleanup);

describe("kit de formulário (shadcn)", () => {
  it("a lista mostra o rótulo da opção escolhida, não o id; vazia mostra o placeholder", () => {
    const options = [
      { value: "u1", label: "UBS Centro" },
      { value: "u2", label: "UBS Norte" },
    ];
    render(
      <FormField label="Unidade">
        <Selection value="u2" onChange={() => {}} options={options} />
      </FormField>,
    );
    expect(screen.getByText("UBS Norte")).toBeDefined();
    expect(screen.queryByText("u2")).toBeNull();
    cleanup();
    render(<Selection value="" onChange={() => {}} options={options} placeholder="Escolha a unidade" />);
    expect(screen.getByText("Escolha a unidade")).toBeDefined();
  });

  it("rótulo ligado ao campo e erro marcado no campo", () => {
    render(
      <FormField label="CEP" error="CEP com 8 dígitos">
        <Text value="0100" onChange={() => {}} />
      </FormField>,
    );
    const field = screen.getByLabelText("CEP");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("CEP com 8 dígitos")).toBeDefined();
  });
});
