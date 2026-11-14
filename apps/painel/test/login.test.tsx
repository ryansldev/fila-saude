import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormularioDeLogin } from "@/components/formulario-login";
import { type Api, ErroDaApi } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";

afterEach(cleanup);

function apiComLogin(sign: () => Promise<unknown>, eu: unknown = undefined): Api {
  const nada = async () => undefined as never;
  return {
    get: (async (caminho: string) => {
      if (caminho !== "/v1/painel/eu") throw new Error(`inesperado ${caminho}`);
      if (eu instanceof Error) throw eu;
      return eu;
    }) as Api["get"],
    post: (async (caminho: string, corpo: unknown) => {
      if (caminho !== "/v1/painel/auth/sign-in/username") throw new Error(`inesperado ${caminho}`);
      expect(corpo).toEqual({ username: "ana.souza", password: "segredo123" });
      return sign();
    }) as Api["post"],
    patch: nada,
    put: nada,
    del: nada,
  };
}

function preencherEEnviar() {
  fireEvent.change(screen.getByLabelText("Login"), { target: { value: "ana.souza" } });
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
    expect(await screen.findByText(/login ou senha inválidos/i)).toBeDefined();
    expect(navegar).not.toHaveBeenCalled();
    cleanup();

    const rede = apiComLogin(async () => {
      throw new ErroDaApi(0, "sem_conexao");
    });
    montar(rede);
    preencherEEnviar();
    expect(await screen.findByText(/tente de novo/i)).toBeDefined();
    cleanup();

    const ok = apiComLogin(async () => ({}), {
      id: "p1",
      nome: "Ana",
      login: "ana.souza",
      vinculos: [],
      funcoes: [{ funcao: "gerente_ubs", unidadeId: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f" }],
      perfis: [{ perfil: "gerente_ubs", unidadeId: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f" }],
    });
    const navegarOk = montar(ok);
    preencherEEnviar();
    await waitFor(() => expect(navegarOk).toHaveBeenCalledWith("/equipe"));
  });

  it("login com formato inválido (422 do better-auth) é credencial errada, não falha de rede", async () => {
    const formato = apiComLogin(async () => {
      throw new ErroDaApi(422, "INVALID_USERNAME");
    });
    montar(formato);
    preencherEEnviar();
    expect(await screen.findByText(/login ou senha inválidos/i)).toBeDefined();
  });

  it("login: sign-in ok mas /eu com 401 mostra erro genérico, não credenciais", async () => {
    const navegar = montar(apiComLogin(async () => ({}), new ErroDaApi(401, "nao_autenticado")));
    preencherEEnviar();
    expect(await screen.findByText(/tente de novo/i)).toBeDefined();
    expect(screen.queryByText(/login ou senha inválidos/i)).toBeNull();
    expect(navegar).not.toHaveBeenCalled();
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
      login: "ana.souza",
      vinculos: [],
      funcoes: [{ funcao: "gestao_sms", unidadeId: null }],
      perfis: [{ perfil: "gestao_sms", unidadeId: null }],
    });
    const navegar = montar(api);
    preencherEEnviar();
    const botao = await screen.findByRole("button", { name: /entrando/i });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    liberar({});
    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/unidades"));
  });
});
