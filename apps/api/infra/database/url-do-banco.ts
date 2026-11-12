// PD-14: o central guarda uma referência ao banco do tenant, nunca a URL.
// `template:<banco>` troca `{banco}` em TENANT_DATABASE_URL_TEMPLATE (dev/teste);
// `env:<VAR>` lê a URL da variável de ambiente VAR (produção: o segredo fica no ambiente, não no banco).
export function urlDoBanco(ref: string, deps: { template: string; env?: Record<string, string | undefined> }): string {
  if (ref.startsWith("template:")) {
    const banco = ref.slice("template:".length);
    if (!banco) throw new Error("referência de banco sem nome: template:");
    return deps.template.replace("{banco}", banco);
  }
  if (ref.startsWith("env:")) {
    const variavel = ref.slice("env:".length);
    if (!variavel) throw new Error("referência de banco sem nome: env:");
    const url = (deps.env ?? process.env)[variavel];
    if (!url) throw new Error(`variável de ambiente ausente: ${variavel}`);
    return url;
  }
  throw new Error(`referência de banco desconhecida: ${ref}`);
}
