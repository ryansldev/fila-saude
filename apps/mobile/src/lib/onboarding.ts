/** Guardado depois que a pessoa vê (ou pula) o "conhecer o app". */
export const CHAVE_ONBOARDING = "fila-saude.onboarding";

export type RotaSemConta = "/boas-vindas" | "/entrar";

/**
 * Pilha de telas para quem está sem conta. Quem já viu o onboarding cai direto em "entrar",
 * mas com as boas-vindas por baixo: o "voltar" leva lá, de onde dá para criar a conta.
 */
export function destinoSemConta(visto: string | null): RotaSemConta[] {
  return visto ? ["/boas-vindas", "/entrar"] : ["/boas-vindas"];
}

export function proximoPasso(atual: number, total: number): number | "fim" {
  return atual + 1 >= total ? "fim" : atual + 1;
}

export function passoAnterior(atual: number): number | "sair" {
  return atual <= 0 ? "sair" : atual - 1;
}
