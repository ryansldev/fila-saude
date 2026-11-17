import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProtectedContent } from "@/components/protected-content";
import { canAccess } from "@/lib/navigation";

afterEach(cleanup);

const manager = [{ profile: "unit_manager" as const, unitId: "u1" }];
const sms = [{ profile: "sms_management" as const, unitId: null }];
const reception = [{ profile: "reception" as const, unitId: "u1" }];

describe("acesso às páginas do painel", () => {
  it("cada página exige a ação do item do menu, inclusive em subcaminhos", () => {
    expect(canAccess("/unidades", sms)).toBe(true);
    expect(canAccess("/unidades", manager)).toBe(false);
    expect(canAccess("/unidades/123", manager)).toBe(false);
    expect(canAccess("/servicos", manager)).toBe(true);
    expect(canAccess("/servicos", sms)).toBe(false);
    expect(canAccess("/equipe", manager)).toBe(true);
    expect(canAccess("/equipe", reception)).toBe(false);
    expect(canAccess("/sessoes", reception)).toBe(false);
  });

  it("'Em breve' é de quem está logado; caminho desconhecido segue para o 404", () => {
    expect(canAccess("/em-breve", reception)).toBe(true);
    expect(canAccess("/nao-existe", reception)).toBe(true);
  });

  it("sem permissão a página não renderiza e aparece o aviso com o caminho de volta", () => {
    render(
      <ProtectedContent path="/unidades" profiles={reception}>
        <p>conteúdo secreto</p>
      </ProtectedContent>,
    );
    expect(screen.queryByText("conteúdo secreto")).toBeNull();
    expect(screen.getByRole("heading", { name: /sem acesso/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /fila do dia/i }).getAttribute("href")).toBe("/fila");
  });

  it("com permissão a página renderiza", () => {
    render(
      <ProtectedContent path="/unidades" profiles={sms}>
        <p>conteúdo da SMS</p>
      </ProtectedContent>,
    );
    expect(screen.getByText("conteúdo da SMS")).toBeDefined();
  });
});
