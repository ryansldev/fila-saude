import { validarSlug } from "./slug";

export type ConfigDaResolucao = { modo: "multi" | "single"; dominioBase: string; slugFixo?: string };
export type EntradaDaResolucao = { host: string | undefined; slugDoCaminho: string | undefined };
export type ResultadoDaResolucao = { slug: string } | { erro: "sem_tenant" | "municipio_divergente" };

// PD-15: o painel e a TV chegam por `<slug>.<dominioBase>` (Host); o app, por `/v1/municipios/:slug/…`.
// Com os dois presentes e diferentes → `municipio_divergente`. No modo `single` (PD-12) o tenant é
// sempre `slugFixo` e o Host é ignorado (a VPS do município pode ter qualquer domínio); caminho com
// outro slug → `sem_tenant`.
// Função pura: não consulta o catálogo; existir ou estar ativo é decidido depois (`PoolsDosTenants`).
export function resolverTenant(entrada: EntradaDaResolucao, config: ConfigDaResolucao): ResultadoDaResolucao {
  const doCaminho = entrada.slugDoCaminho;

  if (config.modo === "single") {
    if (!config.slugFixo) return { erro: "sem_tenant" };
    // A VPS do município não conhece outros municípios: outro slug no caminho é desconhecido (404),
    // com a mesma resposta de um slug que não existe em lugar nenhum.
    if (doCaminho !== undefined && doCaminho !== config.slugFixo) return { erro: "sem_tenant" };
    return { slug: config.slugFixo };
  }

  const doHost = slugDoHost(entrada.host, config.dominioBase);
  if (doHost && doCaminho !== undefined && doCaminho !== doHost) return { erro: "municipio_divergente" };
  if (doHost) return { slug: doHost };
  if (doCaminho !== undefined && validarSlug(doCaminho)) return { slug: doCaminho };
  return { erro: "sem_tenant" };
}

// `pref-a.localhost:3333` → `pref-a`. Host raiz, IP, outro domínio, subdomínio duplo ou fora do
// formato de slug → null. Comparação sem diferenciar maiúsculas (nomes DNS não diferenciam).
function slugDoHost(host: string | undefined, dominioBase: string): string | null {
  if (!host) return null;
  // IPv6 literal (`[::1]:3333`) nunca é subdomínio.
  if (host.startsWith("[")) return null;

  const semPorta = host.replace(/:\d*$/, "").toLowerCase().replace(/\.$/, "");
  const sufixo = `.${dominioBase.toLowerCase().replace(/\.$/, "")}`;
  if (!semPorta.endsWith(sufixo)) return null;

  const sub = semPorta.slice(0, -sufixo.length);
  // `validarSlug` já recusa ponto (subdomínio duplo), vazio e IPv4 (começa com dígito).
  return validarSlug(sub) ? sub : null;
}
