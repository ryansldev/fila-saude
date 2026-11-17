// Nomes de pessoas: sempre com a primeira letra maiúscula, no app, no painel e na API (regra do projeto).

const parts = (name: string) => name.trim().split(/\s+/).filter(Boolean);
const CONNECTIVES = new Set(["da", "de", "do", "das", "dos", "e"]);
const capitalize = (p: string) => p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");

/** "maria DA silva" → "Maria da Silva". */
export const properName = (name: string): string =>
  parts(name)
    .map((p, i) =>
      i > 0 && CONNECTIVES.has(p.toLocaleLowerCase("pt-BR")) ? p.toLocaleLowerCase("pt-BR") : capitalize(p),
    )
    .join(" ");

/** "ana souza" → "Ana". */
export const firstName = (name: string): string => properName(parts(name)[0] ?? "");
