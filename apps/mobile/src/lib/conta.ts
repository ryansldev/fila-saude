import { soDigitos } from "@fila-saude/schemas/mascaras";
import type { EstadoDosAvisos } from "./push";

/** "52998224725" → "•••.982.247-••": só o meio aparece, como no gov.br (alguém pode estar olhando a tela). */
export function cpfEscondido(cpf: string): string {
  const d = soDigitos(cpf);
  if (d.length !== 11) return "";
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
}

const partes = (nome: string) => nome.trim().split(/\s+/).filter(Boolean);

/** "Ana Maria da Silva" → "AS" (a bolinha do avatar). */
export function iniciais(nome: string): string {
  const p = partes(nome);
  const primeira = p[0]?.[0] ?? "";
  const ultima = p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

export const primeiroNome = (nome: string): string => (partes(nome)[0] ?? "").toLowerCase();

export type Municipio = { slug: string; nome: string; uf: string | null };

export const rotuloDoMunicipio = (m: Municipio): string => (m.uf ? `${m.nome} - ${m.uf}` : m.nome);

export function nomeDoMunicipio(lista: Municipio[] | null, slug: string | null): string | null {
  const m = slug ? lista?.find((x) => x.slug === slug) : undefined;
  return m ? rotuloDoMunicipio(m) : null;
}

/** A linha "avisos" da conta: ligados ou não, e o que o toque faz. */
export function textoDosAvisos(estado: EstadoDosAvisos | null): { ligados: boolean; texto: string } {
  if (!estado) return { ligados: false, texto: "verificando…" };
  if (estado.tipo === "ligados") return { ligados: true, texto: "ligados neste celular" };
  if (estado.tipo === "desligados" && !estado.podePedir)
    return { ligados: false, texto: "desligados. toque para ligar nos ajustes" };
  return { ligados: false, texto: "desligados. toque para ligar" };
}
