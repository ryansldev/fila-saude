import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const path = "/v1/test/tenant";

let a: Awaited<ReturnType<typeof orchestrator.createMunicipality>>;
let b: Awaited<ReturnType<typeof orchestrator.createMunicipality>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  a = await orchestrator.createMunicipality();
  b = await orchestrator.createMunicipality();
});

afterAll(async () => {
  await orchestrator.dropMunicipalities();
});

describe("GET /v1/test/tenant", () => {
  it("PD-15: Host do tenant A usa o banco de A", async () => {
    const response = await fetch(`${orchestrator.tenantOrigin(a.slug)}${path}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: a.slug, database: a.database });
  });

  it("PD-15: Host do tenant B usa o banco de B", async () => {
    const response = await fetch(`${orchestrator.tenantOrigin(b.slug)}${path}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: b.slug, database: b.database });
  });

  it("PD-15: host raiz em rota de tenant → 404", async () => {
    const response = await fetch(`${webserver.origin}${path}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_municipality" });
  });

  it("PD-15: subdomínio fora do formato de slug → 404 unknown_municipality", async () => {
    const response = await fetch(`${orchestrator.tenantOrigin("x_y")}${path}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_municipality" });
  });

  it("PD-15: slug desconhecido e município suspenso → 404 unknown_municipality", async () => {
    const suspended = await orchestrator.createMunicipality();
    await database.update(municipality).set({ status: "suspended" }).where(eq(municipality.slug, suspended.slug));

    const unknown = await fetch(`${orchestrator.tenantOrigin(orchestrator.uniqueSlug())}${path}`);
    const fromSuspended = await fetch(`${orchestrator.tenantOrigin(suspended.slug)}${path}`);

    expect(unknown.status).toBe(404);
    expect(fromSuspended.status).toBe(404);
    const unknownBody = await unknown.text();
    expect(unknownBody).toBe('{"error":"unknown_municipality"}');
    // Mesmo corpo byte a byte: a resposta não revela que o município existe.
    expect(await fromSuspended.text()).toBe(unknownBody);
  });

  it("PD-15: rota da raiz não depende de tenant nem no host raiz nem num subdomínio", async () => {
    const inRoot = await fetch(`${webserver.origin}/v1/status`);
    expect(inRoot.status).toBe(200);
    const withUnknownSlug = await fetch(`${orchestrator.tenantOrigin(orchestrator.uniqueSlug())}/v1/status`);
    expect(withUnknownSlug.status).toBe(200);
  });
});
