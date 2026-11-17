import { errorSchema } from "@fila-saude/schemas/errors";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

const url = `${webserver.origin}/v1/test/eco`;

function post(body: string, kind = "application/json") {
  return fetch(url, { method: "POST", headers: { "content-type": kind }, body: body });
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("POST /v1/test/eco", () => {
  it("PD-19: rotas de teste existem em NODE_ENV=test", async () => {
    const response = await post(JSON.stringify({ text: "oi", times: 2 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "oi", times: 2 });
  });

  it("PD-22: corpo inválido → 400 entrada_invalida com os campos", async () => {
    const response = await post(JSON.stringify({ text: "", times: "x" }));
    expect(response.status).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.error).toBe("invalid_input");
    expect(Object.keys(body.fields ?? {}).sort()).toEqual(["text", "times"]);
    expect(body.fields?.text?.length).toBeGreaterThan(0);
  });

  it("PD-22: erro na raiz do objeto vai na chave _", async () => {
    const response = await post(JSON.stringify("nao-e-objeto"));
    expect(response.status).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.fields?._?.length).toBeGreaterThan(0);
  });

  it("PD-22: JSON malformado → 400 entrada_invalida", async () => {
    const response = await post("{texto:");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_input" });
  });

  it("PD-22: ErroApi vira { erro: codigo } com o status dele", async () => {
    const response = await post(JSON.stringify({ text: "negocio", times: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "test_conflict" });
  });

  it("PD-22: erro desconhecido → 500 erro_interno sem vazar a mensagem", async () => {
    const response = await post(JSON.stringify({ text: "interno", times: 1 }));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "erro_interno" });
    expect(text).not.toContain("segredo");
  });

  it("PD-22: rota inexistente → 404 nao_encontrado", async () => {
    const response = await fetch(`${webserver.origin}/v1/not-exists`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
