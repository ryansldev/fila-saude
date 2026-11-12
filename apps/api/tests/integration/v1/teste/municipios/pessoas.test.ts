import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: Awaited<ReturnType<typeof orchestrator.criarMunicipio>>;
let b: Awaited<ReturnType<typeof orchestrator.criarMunicipio>>;

function pessoas(origem: string, slug: string) {
  return `${origem}/v1/teste/municipios/${slug}/pessoas`;
}

async function gravar(url: string, nome: string) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nome, nascimento: "1990-05-17" }),
  });
}

async function nomes(url: string) {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  const corpo = (await response.json()) as { nome: string }[];
  return corpo.map((pessoa) => pessoa.nome);
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  a = await orchestrator.criarMunicipio();
  b = await orchestrator.criarMunicipio();
});

afterAll(async () => {
  await orchestrator.derrubarMunicipios();
});

describe("/v1/teste/municipios/:slug/pessoas", () => {
  it("T1.7: pessoa gravada no A nunca aparece no B (pelo caminho)", async () => {
    const criada = await gravar(pessoas(webserver.origin, a.slug), "Ana pelo caminho");
    expect(criada.status).toBe(201);
    expect(await criada.json()).toMatchObject({ nome: "Ana pelo caminho", nascimento: "1990-05-17" });

    expect(await nomes(pessoas(webserver.origin, a.slug))).toContain("Ana pelo caminho");
    expect(await nomes(pessoas(webserver.origin, b.slug))).toEqual([]);
  });

  it("T1.7: pessoa gravada no A nunca aparece no B (pelo Host)", async () => {
    const criada = await gravar(pessoas(orchestrator.origemDoTenant(a.slug), a.slug), "Bia pelo Host");
    expect(criada.status).toBe(201);

    expect(await nomes(pessoas(orchestrator.origemDoTenant(a.slug), a.slug))).toContain("Bia pelo Host");
    expect(await nomes(pessoas(orchestrator.origemDoTenant(b.slug), b.slug))).toEqual([]);
  });

  it("PD-15: Host de A com caminho de B → 400 municipio_divergente", async () => {
    const leitura = await fetch(pessoas(orchestrator.origemDoTenant(a.slug), b.slug));
    expect(leitura.status).toBe(400);
    expect(await leitura.json()).toEqual({ erro: "municipio_divergente" });

    // A escrita também é recusada antes de tocar em qualquer banco: nada aparece em A nem em B.
    const escrita = await gravar(pessoas(orchestrator.origemDoTenant(a.slug), b.slug), "Caio divergente");
    expect(escrita.status).toBe(400);
    expect(await escrita.json()).toEqual({ erro: "municipio_divergente" });
    expect(await nomes(pessoas(webserver.origin, b.slug))).toEqual([]);
    expect(await nomes(pessoas(webserver.origin, a.slug))).not.toContain("Caio divergente");
  });

  it("PD-15: caminho com slug desconhecido → 404 municipio_desconhecido", async () => {
    const response = await fetch(pessoas(webserver.origin, orchestrator.slugUnico()));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ erro: "municipio_desconhecido" });
  });

  it("PD-22: corpo inválido → 400 entrada_invalida", async () => {
    const response = await fetch(pessoas(webserver.origin, a.slug), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: "" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ erro: "entrada_invalida" });
  });
});
