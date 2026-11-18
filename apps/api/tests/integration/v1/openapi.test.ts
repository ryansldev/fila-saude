import { readFile } from "node:fs/promises";
import { validate } from "@scalar/openapi-parser";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

type Operation = {
  tags?: string[];
  summary?: string;
  security?: Record<string, string[]>[];
  responses: Record<string, { content?: Record<string, { schema: { $ref?: string } }> }>;
};
type Doc = {
  openapi: string;
  servers: { url: string; variables?: Record<string, { default: string }> }[];
  paths: Record<string, Record<string, Operation>>;
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> };
};

let doc: Doc;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  doc = (await (await fetch(`${webserver.origin}/v1/test/openapi`)).json()) as Doc;
});

const operations = () =>
  Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ path, method, op })),
  );

describe("documento OpenAPI da v1 (DOC2)", () => {
  it("o openapi/v1.json no git é o documento das rotas (senão: npm run docs:openapi)", async () => {
    const committed = JSON.parse(await readFile(new URL("../../../openapi/v1.json", import.meta.url), "utf8"));
    expect(committed).toEqual(doc);
  });

  it("é um OpenAPI 3.1 válido", async () => {
    expect(doc.openapi).toMatch(/^3\.1\./);
    const result = await validate(JSON.parse(JSON.stringify(doc)));
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("DOC4: só a /v1, sem as rotas de teste nem as do better-auth", () => {
    const paths = Object.keys(doc.paths);
    expect(paths.length).toBeGreaterThan(40);
    expect(paths.every((p) => p.startsWith("/v1/"))).toBe(true);
    // O `autoload` registra `/v1/status/`; os clientes chamam `/v1/status` (o Fastify aceita os dois).
    expect(paths.filter((p) => p.endsWith("/"))).toEqual([]);
    expect(paths.some((p) => p.startsWith("/v1/test"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/v1/auth") || p.startsWith("/v1/panel/auth"))).toBe(false);
  });

  it("DOC4: toda operação tem grupo e resumo em português", () => {
    const groups = new Set(["Município", "Paciente", "Painel", "TV", "Sistema"]);
    for (const { path, method, op } of operations()) {
      expect([path, method, op.tags?.every((t) => groups.has(t)) && op.tags.length === 1]).toEqual([
        path,
        method,
        true,
      ]);
      expect([path, method, Boolean(op.summary)]).toEqual([path, method, true]);
    }
  });

  it("PD-22: os erros citam o componente ApiError", () => {
    expect(doc.components.schemas.ApiError).toBeDefined();
    const unit = doc.paths["/v1/panel/units/{unitId}"]?.get;
    expect(unit?.responses["401"]?.content?.["application/json"]?.schema.$ref).toBe("#/components/schemas/ApiError");
  });

  it("segurança: paciente, painel e TV", () => {
    expect(Object.keys(doc.components.securitySchemes).sort()).toEqual([
      "panelCookie",
      "patientBearer",
      "patientCookie",
      "tvBearer",
    ]);
    expect(doc.paths["/v1/panel/units"]?.get?.security).toEqual([{ panelCookie: [] }]);
  });

  it("PD-15: o servidor do município tem a variável {municipality}", () => {
    const tenant = doc.servers.find((s) => s.url.includes("{municipality}"));
    expect(tenant?.variables?.municipality?.default).toBe("exemplo");
  });

  it("transform: o corpo mostra a entrada (texto) e a resposta a saída", () => {
    const create = doc.paths["/v1/panel/units"]?.post as unknown as {
      requestBody: { content: { "application/json": { schema: unknown } } };
    };
    expect(JSON.stringify(create.requestBody.content["application/json"].schema)).toContain("postalCode");
  });
});
