/** Cabeçalho que o proxy preenche com o slug do município para as páginas do servidor. */
export const CABECALHO_SLUG = "x-fila-saude-slug";

const ROTULO_VALIDO = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Extrai o slug do município do `Host` (PD-09): `pref-a.localhost:3000` → `pref-a`.
 * Domínio raiz, subdomínio duplo, outro domínio ou rótulo inválido → `null`.
 */
export function slugDoHost(host: string, dominioBase: string): string | null {
  const semPorta = host.trim().toLowerCase().replace(/:\d+$/, "");
  const sufixo = `.${dominioBase.toLowerCase()}`;
  if (!semPorta.endsWith(sufixo)) return null;
  const slug = semPorta.slice(0, -sufixo.length);
  if (slug.includes(".") || !ROTULO_VALIDO.test(slug)) return null;
  return slug;
}

/**
 * Base da API (PD-24): em dev, mesmo host na porta configurada; em produção (sem porta), mesma origem.
 */
export function urlDaApi(
  local: { protocol: string; hostname: string },
  env: { NEXT_PUBLIC_API_PORTA?: string | undefined },
): string {
  const porta = env.NEXT_PUBLIC_API_PORTA;
  if (!porta) return "";
  return `${local.protocol}//${local.hostname}:${porta}`;
}

export type DestinoDoProxy = { tipo: "segue"; slug: string } | { tipo: "municipio_nao_encontrado" };

export function destinoDoProxy(host: string | null, dominioBase: string): DestinoDoProxy {
  const slug = host ? slugDoHost(host, dominioBase) : null;
  return slug ? { tipo: "segue", slug } : { tipo: "municipio_nao_encontrado" };
}
