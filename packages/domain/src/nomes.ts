// Nomes de pessoas: sempre com a primeira letra maiúscula, no app, no painel e na API (regra do projeto).

const partes = (nome: string) => nome.trim().split(/\s+/).filter(Boolean);
const CONECTIVOS = new Set(["da", "de", "do", "das", "dos", "e"]);
const capitalizar = (p: string) => p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");

/** "maria DA silva" → "Maria da Silva". */
export const nomeProprio = (nome: string): string =>
  partes(nome)
    .map((p, i) =>
      i > 0 && CONECTIVOS.has(p.toLocaleLowerCase("pt-BR")) ? p.toLocaleLowerCase("pt-BR") : capitalizar(p),
    )
    .join(" ");

/** "ana souza" → "Ana". */
export const primeiroNome = (nome: string): string => nomeProprio(partes(nome)[0] ?? "");
