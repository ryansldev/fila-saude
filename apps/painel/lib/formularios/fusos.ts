/**
 * Os 16 fusos IANA do Brasil (tzdata, zone1970.tab), com os estados de cada um.
 * Brasília (America/Sao_Paulo) é o padrão.
 */
export const FUSOS_DO_BRASIL = [
  { fuso: "America/Noronha", nome: "Fernando de Noronha" },
  { fuso: "America/Belem", nome: "Pará (leste) e Amapá · Belém" },
  { fuso: "America/Fortaleza", nome: "Maranhão, Piauí, Ceará, Rio Grande do Norte e Paraíba · Fortaleza" },
  { fuso: "America/Recife", nome: "Pernambuco · Recife" },
  { fuso: "America/Araguaina", nome: "Tocantins · Araguaína" },
  { fuso: "America/Maceio", nome: "Alagoas e Sergipe · Maceió" },
  { fuso: "America/Bahia", nome: "Bahia · Salvador" },
  {
    fuso: "America/Sao_Paulo",
    nome: "Horário de Brasília · GO, DF, MG, ES, RJ, SP, PR, SC, RS",
  },
  { fuso: "America/Santarem", nome: "Pará (oeste) · Santarém" },
  { fuso: "America/Campo_Grande", nome: "Mato Grosso do Sul · Campo Grande" },
  { fuso: "America/Cuiaba", nome: "Mato Grosso · Cuiabá" },
  { fuso: "America/Porto_Velho", nome: "Rondônia · Porto Velho" },
  { fuso: "America/Boa_Vista", nome: "Roraima · Boa Vista" },
  { fuso: "America/Manaus", nome: "Amazonas (leste) · Manaus" },
  { fuso: "America/Eirunepe", nome: "Amazonas (oeste) · Eirunepé" },
  { fuso: "America/Rio_Branco", nome: "Acre · Rio Branco" },
] as const;

/** Deslocamento do fuso no instante `agora`, em minutos e em texto ("UTC−3", "UTC+5:30", "UTC"). */
function deslocamento(fuso: string, agora: number): { minutos: number; texto: string } {
  const parte =
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "shortOffset" })
      .formatToParts(agora)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(parte);
  const minutos = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  const texto = minutos === 0 ? "UTC" : parte.replace("GMT", "UTC").replace("-", "−");
  return { minutos, texto };
}

export function rotuloDoFuso(fuso: string, agora = Date.now()): string {
  const conhecido = FUSOS_DO_BRASIL.find((f) => f.fuso === fuso);
  return `${conhecido ? conhecido.nome : fuso} (${deslocamento(fuso, agora).texto})`;
}

/** Opções do select: do leste (Noronha) ao oeste (Acre); no mesmo horário, pelo nome. */
export function opcoesDeFuso(agora = Date.now()): { fuso: string; rotulo: string }[] {
  return FUSOS_DO_BRASIL.map(({ fuso, nome }) => ({ fuso, nome, minutos: deslocamento(fuso, agora).minutos }))
    .sort((a, b) => b.minutos - a.minutos || a.nome.localeCompare(b.nome, "pt-BR"))
    .map(({ fuso }) => ({ fuso, rotulo: rotuloDoFuso(fuso, agora) }));
}
