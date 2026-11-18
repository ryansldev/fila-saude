import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/login-form";
import { type Api, ApiError } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";

afterEach(cleanup);

// AD-062: o widget da Cloudflare não roda no jsdom; aqui ele "resolve" sozinho e entrega um token.
vi.mock("@/components/turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) => {
    useEffect(() => onToken("token-da-cloudflare"), [onToken]);
    return <p>verificação</p>;
  },
}));

function apiWithLogin(sign: () => Promise<unknown>, me: unknown = undefined): Api {
  const nothing = async () => undefined as never;
  return {
    get: (async (path: string) => {
      if (path !== "/v1/panel/me") throw new Error(`inesperado ${path}`);
      if (me instanceof Error) throw me;
      return me;
    }) as Api["get"],
    post: (async (path: string, body: unknown) => {
      if (path !== "/v1/panel/auth/sign-in/username") throw new Error(`inesperado ${path}`);
      expect(body).toEqual({ username: "ana.souza", password: "segredo123" });
      return sign();
    }) as Api["post"],
    patch: nothing,
    put: nothing,
    del: nothing,
  };
}

function fillAndSend() {
  fireEvent.change(screen.getByLabelText("Login"), { target: { value: "ana.souza" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo123" } });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

function build(api: Api, navigate = vi.fn()) {
  render(
    <ApiProvider api={api}>
      <LoginForm navigate={navigate} />
    </ApiProvider>,
  );
  return navigate;
}

describe("login", () => {
  it("login: 401 mostra credenciais inválidas; erro de rede mostra tentar de novo; sucesso navega", async () => {
    const credenciais = apiWithLogin(async () => {
      throw new ApiError(401, "invalid_credentials");
    });
    const navigate = build(credenciais);
    fillAndSend();
    expect(await screen.findByText(/login ou senha inválidos/i)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
    cleanup();

    const network = apiWithLogin(async () => {
      throw new ApiError(0, "no_connection");
    });
    build(network);
    fillAndSend();
    expect(await screen.findByText(/tente de novo/i)).toBeDefined();
    cleanup();

    const ok = apiWithLogin(async () => ({}), {
      id: "p1",
      name: "Ana",
      login: "ana.souza",
      unitLinks: [],
      roles: [{ role: "unit_manager", unitId: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f" }],
      profiles: [{ profile: "unit_manager", unitId: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f" }],
    });
    const navigateOk = build(ok);
    fillAndSend();
    await waitFor(() => expect(navigateOk).toHaveBeenCalledWith("/equipe"));
  });

  it("login com formato inválido (a API responde 400 no campo login) é credencial errada, não falha de rede", async () => {
    const format = apiWithLogin(async () => {
      throw new ApiError(400, "invalid_input", undefined, { login: ["invalid"] });
    });
    build(format);
    fillAndSend();
    expect(await screen.findByText(/login ou senha inválidos/i)).toBeDefined();
  });

  it("login: sign-in ok mas /eu com 401 mostra erro genérico, não credenciais", async () => {
    const navigate = build(apiWithLogin(async () => ({}), new ApiError(401, "not_authenticated")));
    fillAndSend();
    expect(await screen.findByText(/tente de novo/i)).toBeDefined();
    expect(screen.queryByText(/login ou senha inválidos/i)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("RN-ID-04: muitas senhas erradas (429) mostra o texto do servidor, com o tempo de espera", async () => {
    build(
      apiWithLogin(async () => {
        throw new ApiError(429, "login_locked", "Muitas tentativas com senha errada. Espere 15 minutos.");
      }),
    );
    fillAndSend();
    expect(await screen.findByText("Muitas tentativas com senha errada. Espere 15 minutos.")).toBeDefined();
  });

  it("tentativa anterior ainda em andamento (login_busy): o texto do servidor", async () => {
    build(
      apiWithLogin(async () => {
        throw new ApiError(429, "login_busy", "Ainda estamos conferindo a tentativa anterior.");
      }),
    );
    fillAndSend();
    expect(await screen.findByText("Ainda estamos conferindo a tentativa anterior.")).toBeDefined();
  });

  it("limite curto do servidor (429 sem bloqueio do login) pede alguns segundos, não 15 minutos", async () => {
    build(
      apiWithLogin(async () => {
        throw new ApiError(429, "too_many_attempts");
      }),
    );
    fillAndSend();
    expect(await screen.findByText(/espere alguns segundos/i)).toBeDefined();
  });

  it("login: enquanto envia o botão fica desabilitado", async () => {
    let release: (v: unknown) => void = () => {};
    const api = apiWithLogin(() => new Promise((r) => (release = r)), {
      id: "p1",
      name: "Ana",
      login: "ana.souza",
      unitLinks: [],
      roles: [{ role: "sms_management", unitId: null }],
      profiles: [{ profile: "sms_management", unitId: null }],
    });
    const navigate = build(api);
    fillAndSend();
    const button = await screen.findByRole("button", { name: /entrando/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    release({});
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/unidades"));
  });

  it("AD-064: passado o teto do login, mostra o captcha e, resolvido, tenta de novo com o token", async () => {
    const sent: (Record<string, string> | undefined)[] = [];
    const me = {
      id: "p1",
      name: "Ana",
      login: "ana.souza",
      unitLinks: [],
      roles: [{ role: "sms_management", unitId: null }],
      profiles: [{ profile: "sms_management", unitId: null }],
    };
    const api = apiWithLogin(async () => ({}), me);
    const post = api.post;
    api.post = (async (path: string, body: unknown, headers?: Record<string, string>) => {
      sent.push(headers);
      if (sent.length === 1)
        throw new ApiError(429, "captcha_required", "Confirme que você não é um robô para tentar de novo.");
      return post(path, body);
    }) as Api["post"];
    const navigate = build(api);
    fillAndSend();
    expect(await screen.findByText("Confirme que você não é um robô para tentar de novo.")).toBeDefined();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/unidades"));
    expect(sent[1]).toEqual({ "x-captcha-token": "token-da-cloudflare" });
  });

  it("AD-062: token recusado (captcha_failed) mostra o texto e não reenvia sozinho (sem laço)", async () => {
    let calls = 0;
    const api = apiWithLogin(async () => ({}));
    api.post = (async () => {
      calls++;
      if (calls === 1) throw new ApiError(429, "captcha_required", "Confirme que você não é um robô.");
      throw new ApiError(429, "captcha_failed", "Não conseguimos confirmar a verificação.");
    }) as Api["post"];
    build(api);
    fillAndSend();
    expect(await screen.findByText("Não conseguimos confirmar a verificação.")).toBeDefined();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(2);
    expect(screen.queryByText("verificação")).toBeNull();
  });
});
