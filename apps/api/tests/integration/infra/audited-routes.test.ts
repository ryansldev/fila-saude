import Fastify from "fastify";
import { listRoutesWithoutAction, registerRoutes } from "infra/panel/action";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => orchestrator.waitForAllServices());

describe("rotas auditadas", () => {
  it("PD-18: toda rota POST/PUT/PATCH/DELETE sob /v1/panel declara config.acao", async () => {
    const r = await fetch(`${webserver.origin}/v1/test/routes-without-action`);
    expect(await r.json()).toEqual([]);
  });

  it("PD-18: uma rota falsa sem acao é apontada", async () => {
    const app = Fastify();
    registerRoutes(app);
    app.post("/v1/panel/fake", async () => ({}));
    app.post("/v1/panel/right", { config: { action: "create_units_and_rules" } }, async () => ({}));
    app.post("/v1/panel/auth/sign-in", async () => ({}));
    await app.ready();
    expect(listRoutesWithoutAction(app)).toEqual(["POST /v1/panel/fake"]);
    await app.close();
  });
});
