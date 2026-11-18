import env from "infra/env";
import { type ResolutionConfig, resolveTenant } from "infra/tenant/resolve";

// PD-39: `http://{slug}.localhost:3000` em dev.
export function panelOrigin(slug: string, template = env.PANEL_ORIGIN_TEMPLATE): string {
  return template.replace("{slug}", slug);
}

// PD-24: só a origem do painel do mesmo município do Host recebe CORS (função pura). No modo single
// (PD-12) o município é o fixo e o Host é ignorado, como na resolução do tenant.
export function allowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  config: { template: string } & ResolutionConfig,
): boolean {
  if (!origin) return false;
  const { template, ...resolution } = config;
  const r = resolveTenant({ host, pathSlug: undefined }, resolution);
  if ("error" in r) return false;
  return origin === panelOrigin(r.slug, template);
}
