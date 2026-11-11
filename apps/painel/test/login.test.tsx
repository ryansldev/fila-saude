import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormularioDeLogin } from "@/components/formulario-login";
import { type Api, ErroDaApi } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";

afterEach(cleanup);

function apiComLogin(sign: () => Promise<unknown>, eu: unknown = undefined): Api {
  const nada = async () => undefined as never;
  return {
    get: (async () => eu) as Api["get"],
    post: (async (caminho: string) => {
      if (caminho === "/v1/painel/auth/sign-in/email") return sign();
      throw new Error(`inesperado ${caminho}`);
    }) as Api["post"],
    patch: nada,
    put: nada,
    del: nada,
  };
}

function preencherEEnviar() {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo123" } });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

function montar(api: Api, navegar = vi.fn()) {
  render(
    <ApiProvider api={api}>
      <FormularioDeLogin navegar={navegar} />
    </ApiProvider>,
  );
  return navegar;
}

describe("login", () => {
  it("login: 401 mostra credenciais inválidas; erro de rede mostra tentar de novo; sucesso navega", async () => {
    const credenciais = apiComLogin(async () => {
      throw new ErroDaApi(401, "credenciais_invalidas");
    });
    const navegar = montar(credenciais);
    preencherEEnviar();
    expect(await screen.findByText(/e-mail ou senha inválidos/i)).toBeDefined();
    expect(navegar).not.toHaveBeenCalled();
    cleanup();

    const rede = apiComLogin(async () => {
      throw new ErroDaApi(0, "sem_conexao");
    });
    montar(rede);
    preencherEEnviar();
    expect(await screen.findByText(/tentar de novo/i)).toBeDefined();
    cleanup();

    const ok = apiComLogin(async () => ({}), {
      id: "p1",
      nome: "Ana",
      perfis: [{ perfil: "admin", unidadeId: "u1" }],
    });
    const navegarOk = montar(ok);
    preencherEEnviar();
    await waitFor(() => expect(navegarOk).toHaveBeenCalledWith("/servicos"));
  });

  it("login: 423 ou código bloqueado mostra conta bloqueada", async () => {
    montar(
      apiComLogin(async () => {
        throw new ErroDaApi(423, "qualquer");
      }),
    );
    preencherEEnviar();
    expect(await screen.findByText(/conta bloqueada/i)).toBeDefined();
    cleanup();

    montar(
      apiComLogin(async () => {
        throw new ErroDaApi(403, "bloqueado");
      }),
    );
    preencherEEnviar();
    expect(await screen.findByText(/conta bloqueada/i)).toBeDefined();
  });

  it("login: enquanto envia o botão fica desabilitado", async () => {
    let liberar: (v: unknown) => void = () => {};
    const api = apiComLogin(() => new Promise((r) => (liberar = r)), {
      id: "p1",
      nome: "Ana",
      perfis: [{ perfil: "gestor", unidadeId: null }],
    });
    const navegar = montar(api);
    preencherEEnviar();
    const botao = await screen.findByRole("button", { name: /entrando/i });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    liberar({});
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/unidades"));
  });
});
