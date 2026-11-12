/**
 * Os 16 fusos IANA do Brasil (tzdata, zone1970.tab). Rótulo como nos apps (Google Agenda, iOS):
 * "(GMT-03:00) Horário de Brasília - Recife". Brasília (America/Sao_Paulo) é o padrão.
 */
const BRASILIA = "Horário de Brasília";
const AMAZONAS = "Horário do Amazonas";
const ACRE = "Horário do Acre";

export const FUSOS_DO_BRASIL = [
  { fuso: "America/Noronha", horario: "Horário de Fernando de Noronha", cidade: null },
  { fuso: "America/Araguaina", horario: BRASILIA, cidade: "Araguaína" },
  { fuso: "America/Belem", horario: BRASILIA, cidade: "Belém" },
  { fuso: "America/Fortaleza", horario: BRASILIA, cidade: "Fortaleza" },
  { fuso: "America/Maceio", horario: BRASILIA, cidade: "Maceió" },
  { fuso: "America/Recife", horario: BRASILIA, cidade: "Recife" },
  { fuso: "America/Bahia", horario: BRASILIA, cidade: "Salvador" },
  { fuso: "America/Santarem", horario: BRASILIA, cidade: "Santarém" },
  { fuso: "America/Sao_Paulo", horario: BRASILIA, cidade: "São Paulo" },
  { fuso: "America/Boa_Vista", horario: AMAZONAS, cidade: "Boa Vista" },
  { fuso: "America/Campo_Grande", horario: AMAZONAS, cidade: "Campo Grande" },
  { fuso: "America/Cuiaba", horario: AMAZONAS, cidade: "Cuiabá" },
  { fuso: "America/Manaus", horario: AMAZONAS, cidade: "Manaus" },
  { fuso: "America/Porto_Velho", horario: AMAZONAS, cidade: "Porto Velho" },
  { fuso: "America/Eirunepe", horario: ACRE, cidade: "Eirunepé" },
  { fuso: "America/Rio_Branco", horario: ACRE, cidade: "Rio Branco" },
] as const;

/** Deslocamento no instante `agora`: minutos e o texto "GMT-03:00". */
function deslocamento(fuso: string, agora: number): { minutos: number; texto: string } {
  const parte =
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "shortOffset" })
      .formatToParts(agora)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(parte);
  const sinal = m?.[1] === "-" ? "-" : "+";
  const horas = Number(m?.[2] ?? 0);
  const mins = Number(m?.[3] ?? 0);
  const minutos = (sinal === "-" ? -1 : 1) * (horas * 60 + mins);
  return { minutos, texto: `GMT${sinal}${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}` };
}

export function rotuloDoFuso(fuso: string, agora = Date.now()): string {
  const conhecido = FUSOS_DO_BRASIL.find((f) => f.fuso === fuso);
  const nome = conhecido ? (conhecido.cidade ? `${conhecido.horario} - ${conhecido.cidade}` : conhecido.horario) : fuso;
  return `(${deslocamento(fuso, agora).texto}) ${nome}`;
}

/** Opções do select: do leste (Noronha) ao oeste (Acre); no mesmo horário, pela cidade. */
export function opcoesDeFuso(agora = Date.now()): { fuso: string; rotulo: string }[] {
  return FUSOS_DO_BRASIL.map((f) => ({
    fuso: f.fuso,
    cidade: f.cidade ?? "",
    minutos: deslocamento(f.fuso, agora).minutos,
  }))
    .sort((a, b) => b.minutos - a.minutos || a.cidade.localeCompare(b.cidade, "pt-BR"))
    .map(({ fuso }) => ({ fuso, rotulo: rotuloDoFuso(fuso, agora) }));
}
