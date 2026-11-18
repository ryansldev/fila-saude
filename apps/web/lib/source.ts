import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import { openapi } from "@/lib/openapi";

// Endereço sem acento nem maiúscula ("Município" vira "municipio").
const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/(^-|-$)/g, "");

// DOC1: os guias em MDX (`content/docs`) e a referência gerada do OpenAPI, juntos em `/docs`.
const docs = defineDocs({ dir: "content/docs" });

export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    // DOC3: as páginas da v1 ficam em `api/v1`, uma pasta-raiz `api` (a v2 vira outra ao lado).
    // Cada operação vira `<grupo>/<caminho sem /v1>-<método>`, ex.: `painel/panel-units-unitid-get`; os
    // títulos dos grupos com acento estão em `content/docs/api/v1/<grupo>/meta.json`.
    v1: await openapi.staticSource({
      baseDir: "api/v1",
      per: "operation",
      groupBy: "tag",
      slugify,
      name: (output) =>
        output.type === "operation"
          ? `${output.item.path.replace(/^\/v1\//, "").replace(/[{}]/g, "")}-${output.item.method}`
              .replaceAll("/", "-")
              .toLowerCase()
          : slugify(output.item.name),
    }),
  },
  { baseUrl: "/docs", plugins: [openapi.loaderPlugin()] },
);
