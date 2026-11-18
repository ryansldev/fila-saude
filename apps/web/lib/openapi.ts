import { createOpenAPI } from "fumadocs-openapi/server";
import { API_VERSIONS, openapiFile } from "@/lib/api-versions";

// AD-068: um servidor de referência por versão da API, cada um com o seu documento.
export const openapis = API_VERSIONS.map((version) => ({
  version,
  server: createOpenAPI({ input: { [version]: openapiFile(version) } }),
}));
