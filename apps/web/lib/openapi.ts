import { createOpenAPI } from "fumadocs-openapi/server";

// DOC3: uma referência por versão da API, cada uma do seu documento gerado (`npm run docs:openapi`).
// Uma v2 entra aqui como `v2: "../api/openapi/v2.json"`, com a pasta `content/docs/api/v2` ao lado.
export const openapi = createOpenAPI({
  input: { v1: "../api/openapi/v1.json" },
});
