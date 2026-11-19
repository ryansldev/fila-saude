// T1.7: 3 a 30 caracteres, começa com letra, só minúsculas, dígitos e hífen, sem hífen no fim.
const slugFormat = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

export function validateSlug(slug: string): boolean {
  return slugFormat.test(slug);
}

// AD-069: rótulos do próprio produto no domínio (`api.` é a central, `www.` o site, `homolog.` o domínio
// base da homologação). Só valem para o Host (não definem tenant) e na criação (não se cria município com
// esses nomes); o formato do slug, o caminho e o modo single não mudam.
export const RESERVED_SLUGS: readonly string[] = ["api", "www", "homolog", "docs", "admin"];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}

// PD-14: `pref-a` → `fila_t_pref_a`. Como o slug não aceita `_`, dois slugs nunca caem no mesmo banco.
export function databaseForSlug(slug: string): string {
  return `fila_t_${slug.replaceAll("-", "_")}`;
}
