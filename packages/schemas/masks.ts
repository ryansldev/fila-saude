// Máscaras de digitação do app e do painel: formatam enquanto a pessoa digita (ou cola) e nunca
// deixam passar do tamanho. A validação continua nos schemas (cpfSchema, telefoneSchema...).

export const onlyDigits = (t: string): string => t.replace(/\D/g, "");

/** "52998224725" → "529.982.247-25". */
export function maskCpf(t: string): string {
  const d = onlyDigits(t).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "15061990" → "15/06/1990". */
export function maskData(t: string): string {
  const d = onlyDigits(t).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "(11) 98765-4321" (celular) ou "(11) 9876-5432" (fixo). */
export function maskPhone(t: string): string {
  const d = onlyDigits(t).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `;
  const rest = d.slice(2);
  if (rest.length <= 4) return ddd + rest;
  const cut = d.length === 11 ? 5 : 4;
  return `${ddd}${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

/** "01001000" → "01001-000". */
export function maskPostalCode(t: string): string {
  const d = onlyDigits(t).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}
