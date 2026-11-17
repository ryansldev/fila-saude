/** Cabeçalho que o proxy preenche com o slug do município para as páginas do servidor. */
export const SLUG_HEADER = "x-fila-saude-slug";

const VALID_LABEL = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/; // igual ao validateSlug da API

/**
 * Extrai o slug do município do `Host` (PD-09): `pref-a.localhost:3000` → `pref-a`.
 * Domínio raiz, subdomínio duplo, outro domínio ou rótulo inválido → `null`.
 */
export function hostSlug(host: string, domainBase: string): string | null {
  const withoutPort = host.trim().toLowerCase().replace(/:\d+$/, "");
  const suffix = `.${domainBase.toLowerCase()}`;
  if (!withoutPort.endsWith(suffix)) return null;
  const slug = withoutPort.slice(0, -suffix.length);
  if (slug.includes(".") || !VALID_LABEL.test(slug)) return null;
  return slug;
}

/**
 * Base da API (PD-24): em dev, mesmo host na porta configurada; em produção (sem porta), mesma origem.
 */
export function apiUrl(
  local: { protocol: string; hostname: string },
  env: { NEXT_PUBLIC_API_PORT?: string | undefined },
): string {
  const port = env.NEXT_PUBLIC_API_PORT;
  if (!port) return "";
  return `${local.protocol}//${local.hostname}:${port}`;
}

export type ProxyDestination = { kind: "continues"; slug: string } | { kind: "municipality_not_found" };

export function proxyDestination(host: string | null, domainBase: string): ProxyDestination {
  const slug = host ? hostSlug(host, domainBase) : null;
  return slug ? { kind: "continues", slug } : { kind: "municipality_not_found" };
}
