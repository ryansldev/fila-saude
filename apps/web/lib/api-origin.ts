// AD-069: os endereços da API que aparecem nos guias. Em produção, `https://api.filasaude.com.br` (o app) e
// `https://<município>.filasaude.com.br` (painel e TV); em dev, a API local. O build da homologação define
// `DOCS_API_URL=https://api.homolog.filasaude.com.br` e `DOCS_PANEL_URL=https://exemplo.homolog.filasaude.com.br`
// (o `next build` sempre roda como produção).
// `panel` é a API pelo endereço do município (o que o painel e a TV chamam: `{{PANEL_URL}}/v1/panel/…`); em
// dev, a API local na 3333 (o painel em si fica na 3000).
export type Origins = { api: string; panel: string };

type Env = { NODE_ENV?: string; DOCS_API_URL?: string; DOCS_PANEL_URL?: string };

// Variável vazia vale como não definida; a barra final sai (os guias escrevem `{{API_URL}}/v1/…`).
const given = (value: string | undefined) => value?.trim().replace(/\/+$/, "") || undefined;

export function resolveOrigins(env: Env): Origins {
  const production = env.NODE_ENV === "production";
  return {
    api: given(env.DOCS_API_URL) ?? (production ? "https://api.filasaude.com.br" : "http://localhost:3333"),
    panel:
      given(env.DOCS_PANEL_URL) ?? (production ? "https://exemplo.filasaude.com.br" : "http://exemplo.localhost:3333"),
  };
}

export const ORIGINS = resolveOrigins(process.env);
