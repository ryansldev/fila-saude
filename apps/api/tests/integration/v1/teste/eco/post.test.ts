import { erroSchema } from "@fila-saude/schemas/erros";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

const url = `${webserver.origin}/v1/teste/eco`;

function post(corpo: string, tipo = "application/json") {
  return fetch(url, { method: "POST", headers: { "content-type": tipo }, body: corpo });
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("POST /v1/teste/eco", () => {
  it("PD-19: rotas de teste existem em NODE_ENV=test", async () => {
    const response = await post(JSON.stringify({ texto: "oi", vezes: 2 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ texto: "oi", vezes: 2 });
  });

  it("PD-22: corpo inválido → 400 entrada_invalida com os campos", async () => {
    const response = await post(JSON.stringify({ texto: "", vezes: "x" }));
    expect(response.status).toBe(400);
    const corpo = erroSchema.parse(await response.json());
    expect(corpo.erro).toBe("entrada_invalida");
    expect(Object.keys(corpo.campos ?? {}).sort()).toEqual(["texto", "vezes"]);
    expect(corpo.campos?.texto?.length).toBeGreaterThan(0);
  });

  it("PD-22: erro na raiz do objeto vai na chave _", async () => {
    const response = await post(JSON.stringify("nao-e-objeto"));
    expect(response.status).toBe(400);
    const corpo = erroSchema.parse(await response.json());
    expect(corpo.campos?._?.length).toBeGreaterThan(0);
  });

  it("PD-22: JSON malformado → 400 entrada_invalida", async () => {
    const response = await post("{texto:");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ erro: "entrada_invalida" });
  });

  it("PD-22: ErroApi vira { erro: codigo } com o status dele", async () => {
    const response = await post(JSON.stringify({ texto: "negocio", vezes: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ erro: "conflito_de_teste" });
  });

  it("PD-22: erro desconhecido → 500 erro_interno sem vazar a mensagem", async () => {
    const response = await post(JSON.stringify({ texto: "interno", vezes: 1 }));
    expect(response.status).toBe(500);
    const texto = await response.text();
    expect(JSON.parse(texto)).toEqual({ erro: "erro_interno" });
    expect(texto).not.toContain("segredo");
  });

  it("PD-22: rota inexistente → 404 nao_encontrado", async () => {
    const response = await fetch(`${webserver.origin}/v1/nao-existe`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ erro: "nao_encontrado" });
  });
});
