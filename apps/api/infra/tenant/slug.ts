// T1.7: 3 a 30 caracteres, começa com letra, só minúsculas, dígitos e hífen, sem hífen no fim.
const slugFormat = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

export function validateSlug(slug: string): boolean {
  return slugFormat.test(slug);
}

// PD-14: `pref-a` → `fila_t_pref_a`. Como o slug não aceita `_`, dois slugs nunca caem no mesmo banco.
export function databaseForSlug(slug: string): string {
  return `fila_t_${slug.replaceAll("-", "_")}`;
}
