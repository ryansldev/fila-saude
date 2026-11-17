import { onlyDigits } from "@fila-saude/schemas/masks";
import type { NoticeState } from "./push";

/** "52998224725" → "•••.982.247-••": só o meio aparece, como no gov.br (alguém pode estar olhando a tela). */
export function hiddenCpf(cpf: string): string {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return "";
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
}

const parts = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/** "Ana Maria da Silva" → "AS" (a bolinha do avatar). */
export function initials(name: string): string {
  const p = parts(name);
  const first = p[0]?.[0] ?? "";
  const last = p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Nome de pessoa com a primeira letra maiúscula (o resto do app fica em minúsculas): "Maria da Silva". */
export { firstName, properName } from "@fila-saude/domain";

export type Municipality = { slug: string; name: string; uf: string | null };

export const municipalityLabel = (m: Municipality): string => (m.uf ? `${m.name} - ${m.uf}` : m.name);

export function municipalityName(list: Municipality[] | null, slug: string | null): string | null {
  const m = slug ? list?.find((x) => x.slug === slug) : undefined;
  return m ? municipalityLabel(m) : null;
}

/** A linha "avisos" da conta: ligados ou não, e o que o toque faz. */
export function noticeText(state: NoticeState | null): { on: boolean; text: string } {
  if (!state) return { on: false, text: "verificando…" };
  if (state.kind === "on") return { on: true, text: "ligados neste celular" };
  if (state.kind === "off" && !state.canRequest) return { on: false, text: "desligados. toque para ligar nos ajustes" };
  return { on: false, text: "desligados. toque para ligar" };
}
