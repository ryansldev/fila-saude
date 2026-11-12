// PD-14: o central guarda uma referência ao banco do tenant, nunca a URL.
// `template:<banco>` troca `{banco}` em TENANT_DATABASE_URL_TEMPLATE (dev/teste); `env:<VAR>` entra na Task 5.
export function urlDoBanco(ref: string, deps: { template: string }): string {
  if (ref.startsWith("template:")) {
    const banco = ref.slice("template:".length);
    if (!banco) throw new Error("referência de banco sem nome: template:");
    return deps.template.replace("{banco}", banco);
  }
  throw new Error(`referência de banco desconhecida: ${ref}`);
}
