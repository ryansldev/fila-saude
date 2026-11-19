import { describe, expect, it } from "vitest";
import { resolveOrigins } from "@/lib/api-origin";
import { replaceApiUrls } from "@/lib/remark-api-url";

// AD-069: os endereços da API nos guias.
describe("resolveOrigins", () => {
  it("dev: a API local", () => {
    expect(resolveOrigins({ NODE_ENV: "development" })).toEqual({
      api: "http://localhost:3333",
      panel: "http://exemplo.localhost:3333",
    });
  });

  it("produção: api.filasaude.com.br e o município no subdomínio", () => {
    expect(resolveOrigins({ NODE_ENV: "production" })).toEqual({
      api: "https://api.filasaude.com.br",
      panel: "https://exemplo.filasaude.com.br",
    });
  });

  it("homologação: as variáveis trocam os dois, sem a barra final", () => {
    const env = {
      NODE_ENV: "production",
      DOCS_API_URL: "https://api.homolog.filasaude.com.br/",
      DOCS_PANEL_URL: "https://exemplo.homolog.filasaude.com.br",
    };
    expect(resolveOrigins(env)).toEqual({
      api: "https://api.homolog.filasaude.com.br",
      panel: "https://exemplo.homolog.filasaude.com.br",
    });
  });

  it("variável vazia vale como não definida", () => {
    expect(resolveOrigins({ NODE_ENV: "production", DOCS_API_URL: "", DOCS_PANEL_URL: " " }).api).toBe(
      "https://api.filasaude.com.br",
    );
  });
});

describe("replaceApiUrls", () => {
  const origins = { api: "https://api.x", panel: "https://exemplo.x" };

  it("troca no código, no código em linha, nos links e nas propriedades de componente", () => {
    const tree = {
      type: "root",
      children: [
        { type: "code", value: "curl {{API_URL}}/v1/status" },
        { type: "paragraph", children: [{ type: "inlineCode", value: "{{PANEL_URL}}/v1/panel" }] },
        { type: "link", url: "{{API_URL}}/v1", children: [] },
        {
          type: "mdxJsxFlowElement",
          attributes: [{ type: "mdxJsxAttribute", name: "href", value: "{{PANEL_URL}}/v1/panel/units" }],
          children: [],
        },
      ],
    };
    replaceApiUrls(tree, origins);
    expect(JSON.stringify(tree)).not.toContain("{{");
    expect(JSON.stringify(tree)).toContain("https://api.x/v1/status");
    expect(JSON.stringify(tree)).toContain("https://exemplo.x/v1/panel/units");
  });

  it("não mexe em expressões do MDX (que viram código JavaScript)", () => {
    const tree = { type: "root", children: [{ type: "mdxTextExpression", value: "{API_URL}" }] };
    replaceApiUrls(tree, origins);
    expect(tree.children[0]?.value).toBe("{API_URL}");
  });
});
