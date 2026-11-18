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

/**
 * Os botões do "como funciona". Quem revê pela conta já tem conta: nada de "pular" (que leva ao cadastro)
 * nem de "criar minha conta" no fim, que trocaria a sessão por uma conta nova.
 */
export function introButtons(last: boolean, review: boolean): { main: string; secondary: string | null } {
  if (review) return last ? { main: "entendi", secondary: null } : { main: "continuar", secondary: "fechar" };
  return last ? { main: "criar minha conta", secondary: "já tenho conta" } : { main: "continuar", secondary: "pular" };
}
