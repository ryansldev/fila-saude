import { ORIGINS, type Origins } from "@/lib/api-origin";

type Node = {
  type: string;
  value?: unknown;
  url?: string;
  attributes?: { type: string; value?: unknown }[];
  children?: Node[];
};

// Os guias escrevem `{{API_URL}}` e `{{PANEL_URL}}` em blocos de código, código em linha, links e
// propriedades de componente (texto corrido não: no MDX, `{…}` é JavaScript). No build, viram os endereços
// do ambiente (`lib/api-origin.ts`).
export function replaceApiUrls(tree: Node, origins: Origins) {
  const replace = (text: string) =>
    text.replaceAll("{{API_URL}}", origins.api).replaceAll("{{PANEL_URL}}", origins.panel);
  const walk = (node: Node) => {
    // As expressões do MDX (`mdxTextExpression`, `mdxjsEsm`…) já viraram JavaScript: não se mexe.
    if (!node.type.startsWith("mdx") && typeof node.value === "string") node.value = replace(node.value);
    if (typeof node.url === "string") node.url = replace(node.url);
    for (const attribute of node.attributes ?? []) {
      if (attribute.type === "mdxJsxAttribute" && typeof attribute.value === "string") {
        attribute.value = replace(attribute.value);
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
}

// O plugin do remark: roda antes da busca, que indexa o endereço já trocado.
export function remarkApiUrl() {
  return (tree: Node) => replaceApiUrls(tree, ORIGINS);
}
