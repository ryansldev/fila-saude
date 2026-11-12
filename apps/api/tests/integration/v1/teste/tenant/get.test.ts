import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const caminho = "/v1/teste/tenant";

let a: Awaited<ReturnType<typeof orchestrator.criarMunicipio>>;
let b: Awaited<ReturnType<typeof orchestrator.criarMunicipio>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  a = await orchestrator.criarMunicipio();
  b = await orchestrator.criarMunicipio();
});

afterAll(async () => {
  await orchestrator.derrubarMunicipios();
});

describe("GET /v1/teste/tenant", () => {
  it("PD-15: Host do tenant A usa o banco de A", async () => {
    const response = await fetch(`${orchestrator.origemDoTenant(a.slug)}${caminho}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: a.slug, banco: a.banco });
  });

  it("PD-15: Host do tenant B usa o banco de B", async () => {
    const response = await fetch(`${orchestrator.origemDoTenant(b.slug)}${caminho}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: b.slug, banco: b.banco });
  });

  it("PD-15: host raiz em rota de tenant → 404", async () => {
    const response = await fetch(`${webserver.origin}${caminho}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ erro: "municipio_desconhecido" });
  });

  it("PD-15: subdomínio fora do formato de slug → 404 municipio_desconhecido", async () => {
    const response = await fetch(`${orchestrator.origemDoTenant("x_y")}${caminho}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ erro: "municipio_desconhecido" });
  });

  it("PD-15: slug desconhecido e município suspenso → 404 municipio_desconhecido", async () => {
    const suspenso = await orchestrator.criarMunicipio();
    await database.update(municipio).set({ status: "suspenso" }).where(eq(municipio.slug, suspenso.slug));

    const desconhecido = await fetch(`${orchestrator.origemDoTenant(orchestrator.slugUnico())}${caminho}`);
    const doSuspenso = await fetch(`${orchestrator.origemDoTenant(suspenso.slug)}${caminho}`);

    expect(desconhecido.status).toBe(404);
    expect(doSuspenso.status).toBe(404);
    const corpoDesconhecido = await desconhecido.text();
    expect(corpoDesconhecido).toBe('{"erro":"municipio_desconhecido"}');
    // Mesmo corpo byte a byte: a resposta não revela que o município existe.
    expect(await doSuspenso.text()).toBe(corpoDesconhecido);
  });

  it("PD-15: rota da raiz não depende de tenant nem no host raiz nem num subdomínio", async () => {
    const naRaiz = await fetch(`${webserver.origin}/v1/status`);
    expect(naRaiz.status).toBe(200);
    const comSlugDesconhecido = await fetch(`${orchestrator.origemDoTenant(orchestrator.slugUnico())}/v1/status`);
    expect(comSlugDesconhecido.status).toBe(200);
  });
});
