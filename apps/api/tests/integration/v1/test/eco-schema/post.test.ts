import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

function post(path: "eco" | "eco-schema", body: string) {
  return fetch(`${webserver.origin}/v1/test/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("POST /v1/test/eco-schema (schema no Fastify)", () => {
  it("PD-22: corpo inválido → o mesmo 400 do validate(), com os campos e as mensagens em português", async () => {
    const body = JSON.stringify({ text: "", times: "x" });
    const viaValidate = await post("eco", body);
    const viaSchema = await post("eco-schema", body);
    expect(viaSchema.status).toBe(400);
    const answer = (await viaSchema.json()) as { fields: Record<string, string[]> };
    expect(answer).toEqual(await viaValidate.json());
    expect(Object.keys(answer.fields).sort()).toEqual(["text", "times"]);
  });

  it("PD-22: erro na raiz do objeto vai na chave _", async () => {
    const body = JSON.stringify("nao-e-objeto");
    const viaSchema = await post("eco-schema", body);
    expect(viaSchema.status).toBe(400);
    expect(await viaSchema.json()).toEqual(await (await post("eco", body)).json());
  });

  it("PD-22: JSON malformado → 400 invalid_input", async () => {
    const response = await post("eco-schema", "{texto:");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_input" });
  });

  it("o handler recebe o corpo já transformado", async () => {
    const response = await post("eco-schema", JSON.stringify({ text: "oi", times: 1, phone: "(11) 98765-4321" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "oi", times: 1, phone: "11987654321" });
  });

  it("resposta fora do schema → 500 internal_error, sem detalhes", async () => {
    const response = await post("eco-schema", JSON.stringify({ text: "wrong-answer", times: 1 }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal_error" });
  });
});
