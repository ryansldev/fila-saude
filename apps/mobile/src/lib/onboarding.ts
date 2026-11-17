/** Guardado depois que a pessoa vê (ou pula) o "conhecer o app". */
export const KEY_ONBOARDING = "fila-saude.onboarding";

export type RouteWithoutAccount = "/boas-vindas" | "/entrar";

/**
 * Pilha de telas para quem está sem conta. Quem já viu o onboarding cai direto em "entrar",
 * mas com as boas-vindas por baixo: o "voltar" leva lá, de onde dá para criar a conta.
 */
export function destinationWithoutAccount(seen: string | null): RouteWithoutAccount[] {
  return seen ? ["/boas-vindas", "/entrar"] : ["/boas-vindas"];
}

export function nextStep(current: number, total: number): number | "end" {
  return current + 1 >= total ? "end" : current + 1;
}

export function previousStep(current: number): number | "leave" {
  return current <= 0 ? "leave" : current - 1;
}
