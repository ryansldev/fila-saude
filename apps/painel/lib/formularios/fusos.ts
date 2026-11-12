/** Fusos do Brasil (IANA). O Mato Grosso e o Amazonas usam o mesmo horário (UTC−4). */
export const FUSOS_DO_BRASIL = [
  { fuso: "America/Sao_Paulo", rotulo: "Horário de Brasília (UTC−3) · maioria dos estados" },
  { fuso: "America/Manaus", rotulo: "Amazonas, Mato Grosso, MS, RO, RR (UTC−4)" },
  { fuso: "America/Rio_Branco", rotulo: "Acre e oeste do Amazonas (UTC−5)" },
  { fuso: "America/Noronha", rotulo: "Fernando de Noronha (UTC−2)" },
] as const;

export function rotuloDoFuso(fuso: string): string {
  return FUSOS_DO_BRASIL.find((f) => f.fuso === fuso)?.rotulo ?? fuso;
}
