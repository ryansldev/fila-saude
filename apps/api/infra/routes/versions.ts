// AD-068: a versão da API é o primeiro trecho do caminho (`/v1`, `/v2`, `/v5`…), nunca um número fixo.
// Sem zero à esquerda (`/v0` e `/v01` não são versões).
const VERSION = /^\/(v[1-9]\d*)(?=[/?]|$)/;

export function apiVersion(url: string): string | null {
  return VERSION.exec(url)?.[1] ?? null;
}

// A rota está sob `/v{n}/<trecho>` (ex.: `panel`, `panel/auth`), em qualquer versão; a query não conta.
export function isUnder(url: string, segment: string): boolean {
  const version = apiVersion(url);
  if (!version) return false;
  const rest = url.slice(version.length + 1);
  return rest === `/${segment}` || rest.startsWith(`/${segment}/`) || rest.startsWith(`/${segment}?`);
}

// Rotas do painel, em qualquer versão (`/v{n}/panel/…`).
export const isPanelRoute = (url: string) => isUnder(url, "panel");
