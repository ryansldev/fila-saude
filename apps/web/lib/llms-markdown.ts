// Os componentes de layout dos guias em Markdown puro, para o `llms.txt` e as páginas `.md`: o herói sai
// (o subtítulo da página já vai junto) e o fluxo vira uma lista numerada.
export function asMarkdown(text: string): string {
  return text.replace(/<Hero[\s\S]*?\/>\n*/g, "").replace(/<Flow steps=\{\[([\s\S]*?)\]\} \/>/g, (_, items: string) =>
    // Cada passo entre aspas (duplas, simples ou crase), sem depender de JSON estrito; `\"` vira `"`.
    [...items.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)]
      .map((m, i) => `${i + 1}. ${(m[2] ?? "").replace(/\\(.)/g, "$1")}`)
      .join("\n"),
  );
}
