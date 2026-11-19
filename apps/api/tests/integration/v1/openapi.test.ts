import { readdir, readFile } from "node:fs/promises";
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

let docs: Record<string, Doc>;
// As rotas de hoje estão na v1; as checagens gerais valem para toda versão.
let doc: Doc;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  docs = (await (await fetch(`${webserver.origin}/v1/test/openapi`)).json()) as Record<string, Doc>;
  doc = docs.v1 as Doc;
});

const operations = () =>
  Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ path, method, op })),
  );

describe("documentos OpenAPI (AD-066, AD-068)", () => {
  it("um arquivo por versão no git, igual ao documento das rotas (senão: npm run docs:openapi)", async () => {
    const dir = new URL("../../../openapi/", import.meta.url);
    const files = (await readdir(dir)).filter((f) => /^v\d+\.json$/.test(f)).sort();
    expect(files).toEqual(
      Object.keys(docs)
        .map((v) => `${v}.json`)
        .sort(),
    );
    for (const [version, current] of Object.entries(docs)) {
      const committed = JSON.parse(await readFile(new URL(`${version}.json`, dir), "utf8"));
      expect([version, committed]).toEqual([version, current]);
    }
  });

  it("cada versão é um OpenAPI 3.1 válido, só com os caminhos dela", async () => {
    for (const [version, current] of Object.entries(docs)) {
      expect(current.openapi).toMatch(/^3\.1\./);
      expect((current as unknown as { info: { version: string } }).info.version).toBe(version);
      expect(Object.keys(current.paths).every((p) => p.startsWith(`/${version}/`))).toBe(true);
      const result = await validate(JSON.parse(JSON.stringify(current)));
      expect([version, result.errors ?? []]).toEqual([version, []]);
    }
  });

  it("sem as rotas de teste nem as do better-auth, e sem a barra final", () => {
    const paths = Object.values(docs).flatMap((d) => Object.keys(d.paths));
    expect(Object.keys(doc.paths).length).toBeGreaterThan(40);
    // O `autoload` registra `/v1/status/`; os clientes chamam `/v1/status` (o Fastify aceita os dois).
    expect(paths.filter((p) => p.endsWith("/"))).toEqual([]);
    expect(paths.filter((p) => /^\/v\d+\/(test|auth|panel\/auth)(\/|$)/.test(p))).toEqual([]);
  });

  it("os grupos vêm declarados, na ordem das docs", () => {
    const tags = (doc as unknown as { tags: { name: string }[] }).tags.map((t) => t.name);
    expect(tags).toEqual(["Município", "Paciente", "Painel", "TV", "Sistema"]);
  });

  it("toda operação tem grupo e resumo em português", () => {
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

  it("textos em português: nenhuma resposta fica com o padrão do swagger (Default Response)", () => {
    expect(JSON.stringify(doc)).not.toContain("Default Response");
  });

  it("respostas: 2xx com corpo é Sucesso em JSON; 204 sem corpo; erros com os códigos", () => {
    const remove = doc.paths["/v1/panel/units/{unitId}"]?.delete?.responses;
    expect(remove?.["204"]).toEqual({ description: "Sem corpo" });
    const read = doc.paths["/v1/panel/units/{unitId}"]?.get?.responses as Record<string, { description: string }>;
    expect(read["200"]?.description).toBe("Sucesso");
    expect(read["404"]?.description).toContain("not_found");
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
    // AD-069: produção, homologação e dev (o painel e a TV no subdomínio do município; o app em `api.`).
    expect(doc.servers.map((s) => s.url)).toEqual([
      "https://{municipality}.filasaude.com.br",
      "https://api.filasaude.com.br",
      "https://{municipality}.homolog.filasaude.com.br",
      "https://api.homolog.filasaude.com.br",
      "http://{municipality}.localhost:3333",
      "http://localhost:3333",
    ]);
  });

  it("transform: o corpo mostra a entrada (texto) e a resposta a saída", () => {
    const create = doc.paths["/v1/panel/units"]?.post as unknown as {
      requestBody: { content: { "application/json": { schema: unknown } } };
    };
    expect(JSON.stringify(create.requestBody.content["application/json"].schema)).toContain("postalCode");
  });
});
