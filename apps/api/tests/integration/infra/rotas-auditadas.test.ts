import Fastify from "fastify";
import { listarRotasSemAcao, registrarRotas } from "infra/painel/acao";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => orchestrator.waitForAllServices());

describe("rotas auditadas", () => {
  it("PD-18: toda rota POST/PUT/PATCH/DELETE sob /v1/painel declara config.acao", async () => {
    const r = await fetch(`${webserver.origin}/v1/teste/rotas-sem-acao`);
    expect(await r.json()).toEqual([]);
  });

  it("PD-18: uma rota falsa sem acao é apontada", async () => {
    const app = Fastify();
    registrarRotas(app);
    app.post("/v1/painel/falsa", async () => ({}));
    app.post("/v1/painel/certa", { config: { acao: "criar_unidades_regras_usuarios" } }, async () => ({}));
    app.post("/v1/painel/auth/sign-in", async () => ({}));
    await app.ready();
    expect(listarRotasSemAcao(app)).toEqual(["POST /v1/painel/falsa"]);
    await app.close();
  });
});
