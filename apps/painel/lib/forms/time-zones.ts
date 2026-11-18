/**
 * Os 16 fusos IANA do Brasil (tzdata, zone1970.tab). Rótulo como nos apps (Google Agenda, iOS):
 * "(GMT-03:00) Horário de Brasília - Recife". Brasília (America/Sao_Paulo) é o padrão.
 */
const BRASILIA = "Horário de Brasília";
const AMAZONAS = "Horário do Amazonas";
const ACRE = "Horário do Acre";

export const BRAZIL_TIME_ZONES = [
  { timeZone: "America/Noronha", time: "Horário de Fernando de Noronha", city: null },
  { timeZone: "America/Araguaina", time: BRASILIA, city: "Araguaína" },
  { timeZone: "America/Belem", time: BRASILIA, city: "Belém" },
  { timeZone: "America/Fortaleza", time: BRASILIA, city: "Fortaleza" },
  { timeZone: "America/Maceio", time: BRASILIA, city: "Maceió" },
  { timeZone: "America/Recife", time: BRASILIA, city: "Recife" },
  { timeZone: "America/Bahia", time: BRASILIA, city: "Salvador" },
  { timeZone: "America/Santarem", time: BRASILIA, city: "Santarém" },
  { timeZone: "America/Sao_Paulo", time: BRASILIA, city: "São Paulo" },
  { timeZone: "America/Boa_Vista", time: AMAZONAS, city: "Boa Vista" },
  { timeZone: "America/Campo_Grande", time: AMAZONAS, city: "Campo Grande" },
  { timeZone: "America/Cuiaba", time: AMAZONAS, city: "Cuiabá" },
  { timeZone: "America/Manaus", time: AMAZONAS, city: "Manaus" },
  { timeZone: "America/Porto_Velho", time: AMAZONAS, city: "Porto Velho" },
  { timeZone: "America/Eirunepe", time: ACRE, city: "Eirunepé" },
  { timeZone: "America/Rio_Branco", time: ACRE, city: "Rio Branco" },
] as const;

/** Deslocamento no instante `agora`: minutos e o texto "GMT-03:00". */
function offset(timeZone: string, now: number): { minutes: number; text: string } {
  const part =
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(part);
  const signal = m?.[1] === "-" ? "-" : "+";
  const hours = Number(m?.[2] ?? 0);
  const mins = Number(m?.[3] ?? 0);
  const minutes = (signal === "-" ? -1 : 1) * (hours * 60 + mins);
  return { minutes, text: `GMT${signal}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}` };
}

export function timeZoneLabel(timeZone: string, now = Date.now()): string {
  const known = BRAZIL_TIME_ZONES.find((f) => f.timeZone === timeZone);
  const name = known ? (known.city ? `${known.time} - ${known.city}` : known.time) : timeZone;
  return `(${offset(timeZone, now).text}) ${name}`;
}

/** Opções do select: do leste (Noronha) ao oeste (Acre); no mesmo horário, pela cidade. */
export function timeZoneOptions(now = Date.now()): { timeZone: string; label: string }[] {
  return BRAZIL_TIME_ZONES.map((f) => ({
    timeZone: f.timeZone,
    city: f.city ?? "",
    minutes: offset(f.timeZone, now).minutes,
  }))
    .sort((a, b) => b.minutes - a.minutes || a.city.localeCompare(b.city, "pt-BR"))
    .map(({ timeZone }) => ({ timeZone, label: timeZoneLabel(timeZone, now) }));
}
