import env from "infra/env";
import { resolverTenant } from "infra/tenant/resolver";

// PD-39: `http://{slug}.localhost:3000` em dev.
export function origemDoPainel(slug: string, template = env.PAINEL_ORIGEM_TEMPLATE): string {
  return template.replace("{slug}", slug);
}

// PD-24: só a origem do painel do mesmo município do Host recebe CORS (função pura).
export function origemPermitida(
  origem: string | undefined,
  host: string | undefined,
  config: { template: string; dominioBase: string },
): boolean {
  if (!origem) return false;
  const r = resolverTenant({ host, slugDoCaminho: undefined }, { modo: "multi", dominioBase: config.dominioBase });
  if ("erro" in r) return false;
  return origem === origemDoPainel(r.slug, config.template);
}
