// Máscaras de digitação do app e do painel: formatam enquanto a pessoa digita (ou cola) e nunca
// deixam passar do tamanho. A validação continua nos schemas (cpfSchema, telefoneSchema...).

export const soDigitos = (t: string): string => t.replace(/\D/g, "");

/** "52998224725" → "529.982.247-25". */
export function mascararCpf(t: string): string {
  const d = soDigitos(t).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "15061990" → "15/06/1990". */
export function mascararData(t: string): string {
  const d = soDigitos(t).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "(11) 98765-4321" (celular) ou "(11) 9876-5432" (fixo). */
export function mascararTelefone(t: string): string {
  const d = soDigitos(t).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  if (resto.length <= 4) return ddd + resto;
  const corte = d.length === 11 ? 5 : 4;
  return `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** "01001000" → "01001-000". */
export function mascararCep(t: string): string {
  const d = soDigitos(t).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}
