import z from "zod";

export const normalizarCpf = (texto: string): string => texto.replace(/\D/g, "");

function digitoVerificador(digitos: number[], pesoInicial: number): number {
  const soma = digitos.reduce((acc, d, i) => acc + d * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(texto: string): boolean {
  const cpf = normalizarCpf(texto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digitos = [...cpf].map(Number);
  return (
    digitoVerificador(digitos.slice(0, 9), 10) === digitos[9] &&
    digitoVerificador(digitos.slice(0, 10), 11) === digitos[10]
  );
}

export const cpfSchema = z.string().transform(normalizarCpf).refine(cpfValido, "cpf_invalido");
