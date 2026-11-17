import { describe, expect, it } from "vitest";
import { ApiError, createApi, register, signIn } from "@/lib/api";

type Request = { url: string; init: RequestInit };

function fake(answers: Response[]) {
  const requests: Request[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const r = answers.shift();
    if (!r) throw new Error("sem resposta");
    return r;
  }) as unknown as typeof fetch;
  return { requests, fetcher };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("cliente da API do app (PD-34, token)", () => {
  it("manda o token em Authorization e JSON na ida", async () => {
    const { requests, fetcher } = fake([json({ ok: 1 })]);
    const api = createApi("http://api", async () => "tok", fetcher);
    expect(await api.post("/x", { a: 1 })).toEqual({ ok: 1 });
    const h = requests[0]?.init.headers as Record<string, string>;
    expect(requests[0]?.url).toBe("http://api/x");
    expect(h.authorization).toBe("Bearer tok");
    expect(h["content-type"]).toBe("application/json");
    expect(requests[0]?.init.body).toBe('{"a":1}');
  });

  it("put manda o corpo com o token (registro do push, T3.8)", async () => {
    const { requests, fetcher } = fake([json({ ok: true })]);
    const api = createApi("http://api", async () => "tok", fetcher);
    await api.put("/v1/patient/push", { token: "ExponentPushToken[a]" });
    expect(requests[0]?.init.method).toBe("PUT");
    expect(requests[0]?.init.body).toBe('{"token":"ExponentPushToken[a]"}');
  });

  it("401 avisa que a sessão expirou (o app desloga); del manda DELETE", async () => {
    let expired = 0;
    const { requests, fetcher } = fake([json({ error: "not_authenticated" }, 401), json({ ok: true })]);
    const api = createApi(
      "http://api",
      async () => "tok",
      fetcher,
      () => {
        expired++;
      },
    );
    await expect(api.get("/x")).rejects.toMatchObject({ status: 401 });
    expect(expired).toBe(1);
    await api.del("/v1/patient/push", { token: "t" });
    expect(requests[1]?.init.method).toBe("DELETE");
  });

  it("erro no formato da API vira ErroDaApi; sem rede, sem_conexao", async () => {
    const { fetcher } = fake([json({ error: "duplicate" }, 409)]);
    const api = createApi("http://api", async () => null, fetcher);
    await expect(api.get("/x")).rejects.toMatchObject({ status: 409, error: "duplicate" });
    const broken = createApi("http://api", async () => null, (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch);
    await expect(broken.get("/x")).rejects.toBeInstanceOf(ApiError);
    await expect(broken.get("/x")).rejects.toMatchObject({ error: "no_connection" });
  });

  it("entrar usa o CPF só com dígitos e devolve o token do cabeçalho", async () => {
    const { requests, fetcher } = fake([json({ user: {} }, 200, { "set-auth-token": "abc" })]);
    const token = await signIn("http://api", "123.456.789-09", "ticket", fetcher);
    expect(token).toBe("abc");
    expect(requests[0]?.url).toBe("http://api/v1/auth/sign-in/username");
    // O fetch do React Native guarda o cookie da sessão anterior; com ele e sem Origin, o login dá 403.
    expect(requests[0]?.init.credentials).toBe("omit");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ username: "12345678909", password: "ticket" });
  });

  it("login errado → credenciais; cadastro com CPF em uso traz a orientação da API", async () => {
    const { fetcher } = fake([
      json({ code: "INVALID_USERNAME_OR_PASSWORD" }, 401),
      json({ error: "cpf_in_use", message: "Procure a recepção" }, 409),
    ]);
    await expect(signIn("http://api", "1", "x", fetcher)).rejects.toMatchObject({ error: "credentials" });
    await expect(
      register(
        "http://api",
        { name: "A", cpf: "1", email: "a@b.c", phone: "1", birthDate: "2000-01-01", password: "x" },
        fetcher,
      ),
    ).rejects.toMatchObject({ error: "cpf_in_use", message: "Procure a recepção" });
  });
});
