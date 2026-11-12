import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConteudoProtegido } from "@/components/conteudo-protegido";
import { podeAcessar } from "@/lib/navegacao";

afterEach(cleanup);

const gerente = [{ perfil: "gerente_ubs" as const, unidadeId: "u1" }];
const sms = [{ perfil: "gestao_sms" as const, unidadeId: null }];
const recepcao = [{ perfil: "recepcao" as const, unidadeId: "u1" }];

describe("acesso às páginas do painel", () => {
  it("cada página exige a ação do item do menu, inclusive em subcaminhos", () => {
    expect(podeAcessar("/unidades", sms)).toBe(true);
    expect(podeAcessar("/unidades", gerente)).toBe(false);
    expect(podeAcessar("/unidades/123", gerente)).toBe(false);
    expect(podeAcessar("/servicos", gerente)).toBe(true);
    expect(podeAcessar("/servicos", sms)).toBe(false);
    expect(podeAcessar("/equipe", gerente)).toBe(true);
    expect(podeAcessar("/equipe", recepcao)).toBe(false);
    expect(podeAcessar("/sessoes", recepcao)).toBe(false);
  });

  it("'Em breve' é de quem está logado; caminho desconhecido segue para o 404", () => {
    expect(podeAcessar("/em-breve", recepcao)).toBe(true);
    expect(podeAcessar("/nao-existe", recepcao)).toBe(true);
  });

  it("sem permissão a página não renderiza e aparece o aviso com o caminho de volta", () => {
    render(
      <ConteudoProtegido caminho="/unidades" perfis={recepcao}>
        <p>conteúdo secreto</p>
      </ConteudoProtegido>,
    );
    expect(screen.queryByText("conteúdo secreto")).toBeNull();
    expect(screen.getByRole("heading", { name: /sem acesso/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /fila do dia/i }).getAttribute("href")).toBe("/fila");
  });

  it("com permissão a página renderiza", () => {
    render(
      <ConteudoProtegido caminho="/unidades" perfis={sms}>
        <p>conteúdo da SMS</p>
      </ConteudoProtegido>,
    );
    expect(screen.getByText("conteúdo da SMS")).toBeDefined();
  });
});
