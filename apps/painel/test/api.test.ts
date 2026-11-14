import { describe, expect, it } from "vitest";
import { criarApi, ErroDaApi } from "@/lib/api";

type Chamada = { url: string; init: RequestInit };

function fetcherFalso(resposta: () => Response) {
  const chamadas: Chamada[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    return resposta();
  };
  return { fetcher: fetcher as typeof fetch, chamadas };
}

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

describe("criarApi", () => {
  it("api: envia cookie e converte 409 em ErroDaApi com o código", async () => {
    const { fetcher, chamadas } = fetcherFalso(() =>
      json(409, { erro: "sessao_aberta", mensagem: "feche a sessão antes" }),
    );
    const api = criarApi("http://pref-a.localhost:3333", fetcher);

    const erro = await api.post("/v1/servicos", { nome: "Clínico" }).catch((e: unknown) => e);

    expect(chamadas[0]?.init.credentials).toBe("include");
    expect(erro).toBeInstanceOf(ErroDaApi);
    expect(erro).toMatchObject({ status: 409, erro: "sessao_aberta", mensagem: "feche a sessão antes" });
  });

  it("api: GET monta a URL com a base e devolve o JSON", async () => {
    const { fetcher, chamadas } = fetcherFalso(() => json(200, { ok: true }));
    const api = criarApi("http://pref-a.localhost:3333", fetcher);

    await expect(api.get<{ ok: boolean }>("/v1/unidades")).resolves.toEqual({ ok: true });
    expect(chamadas[0]?.url).toBe("http://pref-a.localhost:3333/v1/unidades");
    expect(chamadas[0]?.init.method).toBe("GET");
    expect(chamadas[0]?.init.body).toBeUndefined();
  });

  it("api: base vazia usa a mesma origem (caminho relativo)", async () => {
    const { fetcher, chamadas } = fetcherFalso(() => json(200, {}));
    await criarApi("", fetcher).get("/v1/eu");
    expect(chamadas[0]?.url).toBe("/v1/eu");
  });

  it("api: POST, PATCH e PUT enviam o corpo em JSON com o método certo", async () => {
    const { fetcher, chamadas } = fetcherFalso(() => json(200, {}));
    const api = criarApi("", fetcher);

    await api.post("/a", { x: 1 });
    await api.patch("/b", { y: 2 });
    await api.put("/c", { z: 3 });

    expect(chamadas.map((c) => c.init.method)).toEqual(["POST", "PATCH", "PUT"]);
    expect(chamadas.map((c) => c.init.body)).toEqual(['{"x":1}', '{"y":2}', '{"z":3}']);
    for (const c of chamadas) {
      expect(new Headers(c.init.headers).get("content-type")).toBe("application/json");
      expect(c.init.credentials).toBe("include");
    }
  });

  it("api: DELETE com 204 devolve undefined", async () => {
    const { fetcher, chamadas } = fetcherFalso(() => new Response(null, { status: 204 }));
    await expect(criarApi("", fetcher).del("/v1/x/1")).resolves.toBeUndefined();
    expect(chamadas[0]?.init.method).toBe("DELETE");
  });

  it("PD-22: 400 entrada_invalida traz os campos", async () => {
    const campos = { nome: ["obrigatório"] };
    const { fetcher } = fetcherFalso(() => json(400, { erro: "entrada_invalida", campos }));
    const erro = await criarApi("", fetcher)
      .post("/v1/x", {})
      .catch((e: unknown) => e);
    expect(erro).toMatchObject({ status: 400, erro: "entrada_invalida", campos });
  });

  it("api: erro sem corpo no formato da PD-22 vira ErroDaApi resposta_invalida com o status", async () => {
    const { fetcher } = fetcherFalso(() => new Response("Bad Gateway", { status: 502 }));
    const erro = await criarApi("", fetcher)
      .get("/v1/x")
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaApi);
    expect(erro).toMatchObject({ status: 502, erro: "resposta_invalida" });
  });

  it("api: 2xx com corpo que não é JSON vira ErroDaApi resposta_invalida", async () => {
    const { fetcher } = fetcherFalso(() => new Response("<html>ok</html>", { status: 200 }));
    const erro = await criarApi("", fetcher)
      .get("/v1/x")
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaApi);
    expect(erro).toMatchObject({ status: 200, erro: "resposta_invalida" });
  });

  it("api: falha de rede vira ErroDaApi sem_conexao com status 0", async () => {
    const fetcher = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const erro = await criarApi("", fetcher)
      .get("/v1/x")
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaApi);
    expect(erro).toMatchObject({ status: 0, erro: "sem_conexao" });
  });
});

describe("sessão expirada (revisão 2026-11-13)", () => {
  it("401 em qualquer chamada avisa para voltar ao login", async () => {
    let expirou = 0;
    const fetcher = (async () =>
      new Response(JSON.stringify({ erro: "nao_autenticado" }), { status: 401 })) as unknown as typeof fetch;
    const api = criarApi("", fetcher, () => {
      expirou++;
    });
    await expect(api.get("/v1/painel/eu")).rejects.toMatchObject({ status: 401 });
    expect(expirou).toBe(1);
  });
});
