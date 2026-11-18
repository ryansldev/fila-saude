import Fastify from "fastify";
import { listRoutesWithoutSchema } from "infra/openapi/coverage";
import { registerRoutes } from "infra/panel/action";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => orchestrator.waitForAllServices());

describe("rotas com schema (DOC2)", () => {
  it("toda rota da /v1 declara schema (fora as do better-auth, que fazem o próprio login)", async () => {
    const r = await fetch(`${webserver.origin}/v1/test/routes-without-schema`);
    expect(await r.json()).toEqual([]);
  });

  it("uma rota sem schema ou sem resposta é apontada; HEAD e /v1/test ficam de fora", async () => {
    const app = Fastify();
    registerRoutes(app);
    app.get("/v1/fake", async () => ({}));
    app.post("/v1/no-response", { schema: { body: { type: "object" } } }, async () => ({}));
    app.post(
      "/v1/right",
      { schema: { body: { type: "object" }, response: { 200: { type: "object" } } } },
      async () => ({}),
    );
    app.get("/v1/test/eco", async () => ({}));
    app.get("/other", async () => ({}));
    app.post("/v1/auth/*", async () => ({}));
    app.post("/v1/panel/auth/*", async () => ({}));
    await app.ready();
    expect(listRoutesWithoutSchema(app)).toEqual(["GET /v1/fake", "POST /v1/no-response"]);
    await app.close();
  });
});
