// PD-14: o central guarda uma referência ao banco do tenant, nunca a URL.
// `template:<banco>` troca `{database}` em TENANT_DATABASE_URL_TEMPLATE (dev/teste);
// `env:<VAR>` lê a URL da variável de ambiente VAR (produção: o segredo fica no ambiente, não no banco).
export function databaseUrl(ref: string, deps: { template: string; env?: Record<string, string | undefined> }): string {
  if (ref.startsWith("template:")) {
    const database = ref.slice("template:".length);
    if (!database) throw new Error("referência de banco sem nome: template:");
    return deps.template.replace("{database}", database);
  }
  if (ref.startsWith("env:")) {
    const variable = ref.slice("env:".length);
    if (!variable) throw new Error("referência de banco sem nome: env:");
    const url = (deps.env ?? process.env)[variable];
    if (!url) throw new Error(`variável de ambiente ausente: ${variable}`);
    return url;
  }
  throw new Error(`referência de banco desconhecida: ${ref}`);
}
