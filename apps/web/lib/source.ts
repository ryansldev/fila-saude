import { readFileSync } from "node:fs";
import { llms, loader, type VirtualFile } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";
import { openapiFile } from "@/lib/api-versions";
import { openapis } from "@/lib/openapi";
import { remarkApiUrl } from "@/lib/remark-api-url";

// Endereço sem acento nem maiúscula ("Município" vira "municipio").
const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/(^-|-$)/g, "");

// AD-066: os guias em MDX (`content/docs`) e a referência gerada do OpenAPI, juntos em `/docs`. O Markdown
// processado de cada guia alimenta o `llms.txt` e as páginas em Markdown (`/docs/<página>.md`).
const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // `section`: a seção mostrada acima do título; `hero`: a página traz o próprio cabeçalho (a introdução).
    schema: pageSchema.extend({ section: z.string().optional(), hero: z.boolean().optional() }),
    postprocess: { includeProcessedMarkdown: true },
    // AD-069: `{{API_URL}}` e `{{PANEL_URL}}` viram os endereços do ambiente.
    mdxOptions: applyMdxPreset({ remarkPlugins: (plugins) => [remarkApiUrl, ...plugins] }),
  },
  meta: { schema: metaSchema },
});

type OpenApiDoc = {
  tags?: { name: string }[];
  paths: Record<string, Record<string, { tags?: string[] }>>;
};

// Os grupos (tags) do documento, na ordem que a API declara (ou na ordem em que aparecem).
function groupsOf(version: string): string[] {
  const doc = JSON.parse(readFileSync(openapiFile(version), "utf8")) as OpenApiDoc;
  const seen = Object.values(doc.paths).flatMap((methods) => Object.values(methods).flatMap((op) => op.tags ?? []));
  return [...new Set([...(doc.tags?.map((t) => t.name) ?? []), ...seen])].filter((t) => seen.includes(t));
}

// AD-068: cada versão é uma pasta-raiz `api/v{n}` (uma aba no topo), com um grupo por tag. Os títulos e a
// ordem saem do próprio documento: nada aqui sabe quais versões ou grupos existem.
async function versionSource(version: string, server: (typeof openapis)[number]["server"]) {
  const generated = await server.staticSource({
    baseDir: `api/${version}`,
    per: "operation",
    groupBy: "tag",
    slugify,
    // Cada operação vira `<grupo>/<caminho sem a versão>-<método>`, ex.: `painel/panel-units-unitid-get`.
    name: (output) =>
      output.type === "operation"
        ? `${output.item.path.replace(/^\/v\d+\//, "").replace(/[{}]/g, "")}-${output.item.method}`
            .replaceAll("/", "-")
            .toLowerCase()
        : slugify(output.item.name),
  });
  const groups = groupsOf(version);
  const meta: VirtualFile[] = [
    {
      type: "meta",
      path: `api/${version}/meta.json`,
      data: {
        title: `API ${version}`,
        description: "Referência de todas as rotas",
        icon: "Braces",
        root: true,
        pages: [...groups.map(slugify), "..."],
      },
    },
    ...groups.map((group) => ({
      type: "meta" as const,
      path: `api/${version}/${slugify(group)}/meta.json`,
      data: { title: group },
    })),
  ];
  return { ...generated, files: [...generated.files, ...meta] } as typeof generated;
}

type VersionSource = Awaited<ReturnType<typeof versionSource>>;
const versions: Record<string, VersionSource> = Object.fromEntries(
  await Promise.all(openapis.map(async ({ version, server }) => [version, await versionSource(version, server)])),
);

export const source = loader(
  { docs: docs.toFumadocsSource(), ...versions },
  { baseUrl: "/docs", plugins: [openapis[0]?.server.loaderPlugin() ?? [], lucideIconsPlugin()].flat() },
);

// Os componentes de layout em Markdown puro: o herói sai (o subtítulo já vai junto) e o fluxo vira uma lista.
function asMarkdown(text: string): string {
  return text
    .replace(/<Hero[\s\S]*?\/>\n*/g, "")
    .replace(/<Flow steps=\{(\[[\s\S]*?\])\} \/>/g, (_, steps: string) =>
      (JSON.parse(steps) as string[]).map((step, i) => `${i + 1}. ${step}`).join("\n"),
    );
}

// O Markdown de uma página: o guia como foi escrito; a rota da referência, pelo título e o documento.
export const docsLlms = llms(source, {
  // Um `llms.txt` só, com todas as páginas (sem arquivos por seção).
  section: () => false,
  renderPage: async (page) => {
    if (page.type === "docs") {
      // O subtítulo vai junto: na introdução, o texto do herói fica em props, fora do Markdown processado.
      const lead = page.data.description ? `${page.data.description}\n\n` : "";
      return `# ${page.data.title} (${page.url})\n\n${lead}${asMarkdown(await page.data.getText("processed"))}`;
    }
    return `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ""}\n\nO contrato completo está no documento OpenAPI: /openapi/${page.type}.json`;
  },
});
