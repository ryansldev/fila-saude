import { isAuth, isOutsideReference, splitByVersion } from "infra/openapi/document";
import { isPanelAuth } from "infra/panel/guard";
import { apiVersion, isPanelRoute } from "infra/routes/versions";
import { describe, expect, it } from "vitest";

// AD-068: a versão é um número qualquer no começo do caminho (`/v1`, `/v2`, `/v5`…), nunca fixa.
describe("versões da API", () => {
  it("lê a versão do caminho", () => {
    expect(apiVersion("/v1/status")).toBe("v1");
    expect(apiVersion("/v5/panel/units")).toBe("v5");
    expect(apiVersion("/v12")).toBe("v12");
    expect(apiVersion("/status")).toBeNull();
    expect(apiVersion("/version/x")).toBeNull();
    expect(apiVersion("/v0/x")).toBeNull();
    expect(apiVersion("/v01/x")).toBeNull();
    expect(apiVersion("/v3?x=1")).toBe("v3");
  });

  it("rotas do painel e do login, em qualquer versão", () => {
    expect(isPanelRoute("/v3/panel/units")).toBe(true);
    expect(isPanelRoute("/v3/municipalities")).toBe(false);
    expect(isPanelRoute("/v1/panel?x=1")).toBe(true);
    expect(isPanelRoute("/v1/panelx")).toBe(false);
    expect(isPanelAuth("/v2/panel/auth/sign-in/username")).toBe(true);
    expect(isPanelAuth("/v2/panel/authorizations")).toBe(false);
    expect(isAuth("/v4/auth/sign-in/username")).toBe(true);
    expect(isAuth("/v4/auth")).toBe(true);
  });

  it("fora da referência: sem versão, rotas de teste e login", () => {
    expect(isOutsideReference("/v2/municipalities")).toBe(false);
    expect(isOutsideReference("/v2/test/eco")).toBe(true);
    expect(isOutsideReference("/v2/auth/sign-in/username")).toBe(true);
    expect(isOutsideReference("/documentation")).toBe(true);
  });

  it("separa o documento em um por versão, cada um só com o que usa", () => {
    const schema = { type: "object" };
    const doc = {
      openapi: "3.1.0",
      info: { title: "Fila Saúde", version: "" },
      paths: {
        "/v1/a": { get: { responses: { 200: { $ref: "#/components/schemas/A" } } } },
        "/v2/b": { get: { responses: { 200: { $ref: "#/components/schemas/B" } } } },
      },
      components: {
        schemas: { A: schema, B: { type: "object", properties: { c: { $ref: "#/components/schemas/C" } } }, C: schema },
        securitySchemes: { s: { type: "http" } },
      },
    };
    const docs = splitByVersion(doc);
    expect(Object.keys(docs).sort()).toEqual(["v1", "v2"]);
    expect(Object.keys(docs.v2?.paths ?? {})).toEqual(["/v2/b"]);
    expect(docs.v2?.info.version).toBe("v2");
    expect(Object.keys(docs.v1?.components?.schemas ?? {})).toEqual(["A"]);
    expect(Object.keys(docs.v2?.components?.schemas ?? {}).sort()).toEqual(["B", "C"]);
    expect(docs.v1?.components?.securitySchemes).toEqual({ s: { type: "http" } });
  });
});
