import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: Awaited<ReturnType<typeof orchestrator.createMunicipality>>;
let b: Awaited<ReturnType<typeof orchestrator.createMunicipality>>;

function people(origin: string, slug: string) {
  return `${origin}/v1/test/municipalities/${slug}/people`;
}

async function save(url: string, name: string) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, birthDate: "1990-05-17" }),
  });
}

async function names(url: string) {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { name: string }[];
  return body.map((person) => person.name);
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  a = await orchestrator.createMunicipality();
  b = await orchestrator.createMunicipality();
});

afterAll(async () => {
  await orchestrator.dropMunicipalities();
});

describe("/v1/test/municipalities/:slug/people", () => {
  it("T1.7: pessoa gravada no A nunca aparece no B (pelo caminho)", async () => {
    const created = await save(people(webserver.origin, a.slug), "Ana pelo caminho");
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ name: "Ana pelo caminho", birthDate: "1990-05-17" });

    expect(await names(people(webserver.origin, a.slug))).toContain("Ana pelo caminho");
    expect(await names(people(webserver.origin, b.slug))).toEqual([]);
  });

  it("T1.7: pessoa gravada no A nunca aparece no B (pelo Host)", async () => {
    const created = await save(people(orchestrator.tenantOrigin(a.slug), a.slug), "Bia pelo Host");
    expect(created.status).toBe(201);

    expect(await names(people(orchestrator.tenantOrigin(a.slug), a.slug))).toContain("Bia pelo Host");
    expect(await names(people(orchestrator.tenantOrigin(b.slug), b.slug))).toEqual([]);
  });

  it("PD-15: Host de A com caminho de B → 400 municipio_divergente", async () => {
    const reading = await fetch(people(orchestrator.tenantOrigin(a.slug), b.slug));
    expect(reading.status).toBe(400);
    expect(await reading.json()).toEqual({ error: "municipality_mismatch" });

    // A escrita também é recusada antes de tocar em qualquer banco: nada aparece em A nem em B.
    const write = await save(people(orchestrator.tenantOrigin(a.slug), b.slug), "Caio divergente");
    expect(write.status).toBe(400);
    expect(await write.json()).toEqual({ error: "municipality_mismatch" });
    expect(await names(people(webserver.origin, b.slug))).toEqual([]);
    expect(await names(people(webserver.origin, a.slug))).not.toContain("Caio divergente");
  });

  it("PD-15: caminho com slug desconhecido → 404 unknown_municipality", async () => {
    const response = await fetch(people(webserver.origin, orchestrator.uniqueSlug()));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_municipality" });
  });

  it("PD-22: corpo inválido → 400 entrada_invalida", async () => {
    const response = await fetch(people(webserver.origin, a.slug), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_input" });
  });
});
