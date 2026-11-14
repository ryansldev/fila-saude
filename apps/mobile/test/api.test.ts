import { describe, expect, it } from "vitest";
import { cadastrar, criarApi, ErroDaApi, entrar } from "@/lib/api";

type Pedido = { url: string; init: RequestInit };

function falso(respostas: Response[]) {
  const pedidos: Pedido[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta");
    return r;
  }) as unknown as typeof fetch;
  return { pedidos, fetcher };
}

const json = (corpo: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...headers } });

describe("cliente da API do app (PD-34, token)", () => {
  it("manda o token em Authorization e JSON na ida", async () => {
    const { pedidos, fetcher } = falso([json({ ok: 1 })]);
    const api = criarApi("http://api", async () => "tok", fetcher);
    expect(await api.post("/x", { a: 1 })).toEqual({ ok: 1 });
    const h = pedidos[0]?.init.headers as Record<string, string>;
    expect(pedidos[0]?.url).toBe("http://api/x");
    expect(h.authorization).toBe("Bearer tok");
    expect(h["content-type"]).toBe("application/json");
    expect(pedidos[0]?.init.body).toBe('{"a":1}');
  });

  it("put manda o corpo com o token (registro do push, T3.8)", async () => {
    const { pedidos, fetcher } = falso([json({ ok: true })]);
    const api = criarApi("http://api", async () => "tok", fetcher);
    await api.put("/v1/paciente/push", { token: "ExponentPushToken[a]" });
    expect(pedidos[0]?.init.method).toBe("PUT");
    expect(pedidos[0]?.init.body).toBe('{"token":"ExponentPushToken[a]"}');
  });

  it("401 avisa que a sessão expirou (o app desloga); del manda DELETE", async () => {
    let expirou = 0;
    const { pedidos, fetcher } = falso([json({ erro: "nao_autenticado" }, 401), json({ ok: true })]);
    const api = criarApi(
      "http://api",
      async () => "tok",
      fetcher,
      () => {
        expirou++;
      },
    );
    await expect(api.get("/x")).rejects.toMatchObject({ status: 401 });
    expect(expirou).toBe(1);
    await api.del("/v1/paciente/push", { token: "t" });
    expect(pedidos[1]?.init.method).toBe("DELETE");
  });

  it("erro no formato da API vira ErroDaApi; sem rede, sem_conexao", async () => {
    const { fetcher } = falso([json({ erro: "duplicada" }, 409)]);
    const api = criarApi("http://api", async () => null, fetcher);
    await expect(api.get("/x")).rejects.toMatchObject({ status: 409, erro: "duplicada" });
    const quebrado = criarApi("http://api", async () => null, (async () => {
      throw new TypeError("rede");
    }) as unknown as typeof fetch);
    await expect(quebrado.get("/x")).rejects.toBeInstanceOf(ErroDaApi);
    await expect(quebrado.get("/x")).rejects.toMatchObject({ erro: "sem_conexao" });
  });

  it("entrar usa o CPF só com dígitos e devolve o token do cabeçalho", async () => {
    const { pedidos, fetcher } = falso([json({ user: {} }, 200, { "set-auth-token": "abc" })]);
    const token = await entrar("http://api", "123.456.789-09", "senha", fetcher);
    expect(token).toBe("abc");
    expect(pedidos[0]?.url).toBe("http://api/v1/auth/sign-in/username");
    // O fetch do React Native guarda o cookie da sessão anterior; com ele e sem Origin, o login dá 403.
    expect(pedidos[0]?.init.credentials).toBe("omit");
    expect(JSON.parse(String(pedidos[0]?.init.body))).toEqual({ username: "12345678909", password: "senha" });
  });

  it("login errado → credenciais; cadastro com CPF em uso traz a orientação da API", async () => {
    const { fetcher } = falso([
      json({ code: "INVALID_USERNAME_OR_PASSWORD" }, 401),
      json({ erro: "cpf_em_uso", mensagem: "Procure a recepção" }, 409),
    ]);
    await expect(entrar("http://api", "1", "x", fetcher)).rejects.toMatchObject({ erro: "credenciais" });
    await expect(
      cadastrar(
        "http://api",
        { nome: "A", cpf: "1", email: "a@b.c", telefone: "1", nascimento: "2000-01-01", senha: "x" },
        fetcher,
      ),
    ).rejects.toMatchObject({ erro: "cpf_em_uso", mensagem: "Procure a recepção" });
  });
});
