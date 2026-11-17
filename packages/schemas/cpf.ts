import z from "zod";

export const normalizeCpf = (text: string): string => text.replace(/\D/g, "");

function checkerDigit(digits: number[], initialWeight: number): number {
  const sum = digits.reduce((acc, d, i) => acc + d * (initialWeight - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function validCpf(text: string): boolean {
  const cpf = normalizeCpf(text);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = [...cpf].map(Number);
  return checkerDigit(digits.slice(0, 9), 10) === digits[9] && checkerDigit(digits.slice(0, 10), 11) === digits[10];
}

export const cpfSchema = z.string().transform(normalizeCpf).refine(validCpf, "invalid_cpf");
