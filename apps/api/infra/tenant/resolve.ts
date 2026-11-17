import { validateSlug } from "./slug";

export type ResolutionConfig = { mode: "multi" | "single"; domainBase: string; fixedSlug?: string };
export type ResolutionEntry = { host: string | undefined; pathSlug: string | undefined };
export type ResolutionResult = { slug: string } | { error: "no_tenant" | "municipality_mismatch" };

// PD-15: o painel e a TV chegam por `<slug>.<dominioBase>` (Host); o app, por `/v1/municipalities/:slug/…`.
// Com os dois presentes e diferentes → `municipio_divergente`. No modo `single` (PD-12) o tenant é
// sempre `fixedSlug` e o Host é ignorado (a VPS do município pode ter qualquer domínio); caminho com
// outro slug → `sem_tenant`.
// Função pura: não consulta o catálogo; existir ou estar ativo é decidido depois (`TenantsPools`).
export function resolveTenant(entry: ResolutionEntry, config: ResolutionConfig): ResolutionResult {
  const fromPath = entry.pathSlug;

  if (config.mode === "single") {
    if (!config.fixedSlug) return { error: "no_tenant" };
    // A VPS do município não conhece outros municípios: outro slug no caminho é desconhecido (404),
    // com a mesma resposta de um slug que não existe em lugar nenhum.
    if (fromPath !== undefined && fromPath !== config.fixedSlug) return { error: "no_tenant" };
    return { slug: config.fixedSlug };
  }

  const fromHost = hostSlug(entry.host, config.domainBase);
  if (fromHost && fromPath !== undefined && fromPath !== fromHost) return { error: "municipality_mismatch" };
  if (fromHost) return { slug: fromHost };
  if (fromPath !== undefined && validateSlug(fromPath)) return { slug: fromPath };
  return { error: "no_tenant" };
}

// `pref-a.localhost:3333` → `pref-a`. Host raiz, IP, outro domínio, subdomínio duplo ou fora do
// formato de slug → null. Comparação sem diferenciar maiúsculas (nomes DNS não diferenciam).
function hostSlug(host: string | undefined, domainBase: string): string | null {
  if (!host) return null;
  // IPv6 literal (`[::1]:3333`) nunca é subdomínio.
  if (host.startsWith("[")) return null;

  const withoutPort = host.replace(/:\d*$/, "").toLowerCase().replace(/\.$/, "");
  const suffix = `.${domainBase.toLowerCase().replace(/\.$/, "")}`;
  if (!withoutPort.endsWith(suffix)) return null;

  const sub = withoutPort.slice(0, -suffix.length);
  // `validateSlug` já recusa ponto (subdomínio duplo), vazio e IPv4 (começa com dígito).
  return validateSlug(sub) ? sub : null;
}
