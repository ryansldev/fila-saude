import env from "infra/env";
import { resolveTenant } from "infra/tenant/resolve";

// PD-39: `http://{slug}.localhost:3000` em dev.
export function panelOrigin(slug: string, template = env.PANEL_ORIGIN_TEMPLATE): string {
  return template.replace("{slug}", slug);
}

// PD-24: só a origem do painel do mesmo município do Host recebe CORS (função pura).
export function allowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  config: { template: string; domainBase: string },
): boolean {
  if (!origin) return false;
  const r = resolveTenant({ host, pathSlug: undefined }, { mode: "multi", domainBase: config.domainBase });
  if ("error" in r) return false;
  return origin === panelOrigin(r.slug, config.template);
}
