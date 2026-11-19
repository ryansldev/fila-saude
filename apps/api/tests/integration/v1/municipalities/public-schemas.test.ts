import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { queueScenario } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
});
afterAll(() => orchestrator.dropMunicipalities());

async function get(path: string) {
  const r = await fetch(`${webserver.origin}${path}`);
  return { status: r.status, body: (await r.json()) as { error?: string; fields?: Record<string, string[]> } };
}

// DOC2: com o schema no Fastify, as rotas públicas respondem os mesmos erros de antes.
describe("rotas públicas com schema (DOC2)", () => {
  it("município desconhecido vem antes da query inválida: 404 unknown_municipality", async () => {
    const r = await get("/v1/municipalities/nao-existe/schedule?unitId=abc");
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("unknown_municipality");
  });

  it("query inválida na agenda: 400 invalid_input com o campo", async () => {
    const r = await get(`/v1/municipalities/${c.slug}/schedule?unitId=abc`);
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.fields ?? {})).toEqual(["unitId"]);
  });

  it("id de unidade inválido no caminho: 404 not_found", async () => {
    const r = await get(`/v1/municipalities/${c.slug}/units/abc/services`);
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("not_found");
  });

  it("id no formato que o pathId aceitava (sem versão de uuid) continua aceito", async () => {
    const r = await fetch(
      `${webserver.origin}/v1/municipalities/${c.slug}/units/11111111-1111-1111-1111-111111111111/services`,
    );
    expect(r.status).toBe(200);
  });
});
