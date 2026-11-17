import { describe, expect, it } from "vitest";
import { ApiError, createApi } from "@/lib/api";

type Call = { url: string; init: RequestInit };

function fakeFetcher(answer: () => Response) {
  const calls: Call[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return answer();
  };
  return { fetcher: fetcher as typeof fetch, calls };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createApi", () => {
  it("api: envia cookie e converte 409 em ErroDaApi com o código", async () => {
    const { fetcher, calls } = fakeFetcher(() => json(409, { error: "session_open", message: "feche a sessão antes" }));
    const api = createApi("http://pref-a.localhost:3333", fetcher);

    const error = await api.post("/v1/services", { name: "Clínico" }).catch((e: unknown) => e);

    expect(calls[0]?.init.credentials).toBe("include");
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, error: "session_open", message: "feche a sessão antes" });
  });

  it("api: GET monta a URL com a base e devolve o JSON", async () => {
    const { fetcher, calls } = fakeFetcher(() => json(200, { ok: true }));
    const api = createApi("http://pref-a.localhost:3333", fetcher);

    await expect(api.get<{ ok: boolean }>("/v1/units")).resolves.toEqual({ ok: true });
    expect(calls[0]?.url).toBe("http://pref-a.localhost:3333/v1/units");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("api: base vazia usa a mesma origem (caminho relativo)", async () => {
    const { fetcher, calls } = fakeFetcher(() => json(200, {}));
    await createApi("", fetcher).get("/v1/me");
    expect(calls[0]?.url).toBe("/v1/me");
  });

  it("api: POST, PATCH e PUT enviam o corpo em JSON com o método certo", async () => {
    const { fetcher, calls } = fakeFetcher(() => json(200, {}));
    const api = createApi("", fetcher);

    await api.post("/a", { x: 1 });
    await api.patch("/b", { y: 2 });
    await api.put("/c", { z: 3 });

    expect(calls.map((c) => c.init.method)).toEqual(["POST", "PATCH", "PUT"]);
    expect(calls.map((c) => c.init.body)).toEqual(['{"x":1}', '{"y":2}', '{"z":3}']);
    for (const c of calls) {
      expect(new Headers(c.init.headers).get("content-type")).toBe("application/json");
      expect(c.init.credentials).toBe("include");
    }
  });

  it("api: DELETE com 204 devolve undefined", async () => {
    const { fetcher, calls } = fakeFetcher(() => new Response(null, { status: 204 }));
    await expect(createApi("", fetcher).del("/v1/x/1")).resolves.toBeUndefined();
    expect(calls[0]?.init.method).toBe("DELETE");
  });

  it("PD-22: 400 entrada_invalida traz os campos", async () => {
    const fields = { name: ["obrigatório"] };
    const { fetcher } = fakeFetcher(() => json(400, { error: "invalid_input", fields }));
    const error = await createApi("", fetcher)
      .post("/v1/x", {})
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 400, error: "invalid_input", fields });
  });

  it("api: erro sem corpo no formato da PD-22 vira ErroDaApi invalid_response com o status", async () => {
    const { fetcher } = fakeFetcher(() => new Response("Bad Gateway", { status: 502 }));
    const error = await createApi("", fetcher)
      .get("/v1/x")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, error: "invalid_response" });
  });

  it("api: 2xx com corpo que não é JSON vira ErroDaApi invalid_response", async () => {
    const { fetcher } = fakeFetcher(() => new Response("<html>ok</html>", { status: 200 }));
    const error = await createApi("", fetcher)
      .get("/v1/x")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, error: "invalid_response" });
  });

  it("api: falha de rede vira ErroDaApi sem_conexao com status 0", async () => {
    const fetcher = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const error = await createApi("", fetcher)
      .get("/v1/x")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, error: "no_connection" });
  });
});

describe("sessão expirada (revisão 2026-11-13)", () => {
  it("401 em qualquer chamada avisa para voltar ao login", async () => {
    let expired = 0;
    const fetcher = (async () =>
      new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 })) as unknown as typeof fetch;
    const api = createApi("", fetcher, () => {
      expired++;
    });
    await expect(api.get("/v1/panel/me")).rejects.toMatchObject({ status: 401 });
    expect(expired).toBe(1);
  });
});
