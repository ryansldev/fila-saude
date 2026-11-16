/** Só o primeiro nome (chips da fila da estação: o monitor pode estar à vista de quem está na sala). */
export const primeiroNome = (nome: string): string => nome.trim().split(/\s+/)[0] ?? "";
