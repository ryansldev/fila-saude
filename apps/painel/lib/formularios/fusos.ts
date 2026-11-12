/** Fusos do Brasil em destaque (IANA). Mato Grosso e Amazonas usam o mesmo horário (UTC−4). */
export const FUSOS_DO_BRASIL = [
  { fuso: "America/Sao_Paulo", nome: "Horário de Brasília · maioria dos estados" },
  { fuso: "America/Manaus", nome: "Amazonas, Mato Grosso, MS, RO, RR" },
  { fuso: "America/Rio_Branco", nome: "Acre e oeste do Amazonas" },
  { fuso: "America/Noronha", nome: "Fernando de Noronha" },
] as const;

/** Deslocamento do fuso no instante `agora`: "UTC−3", "UTC+5:30", "UTC". */
function deslocamento(fuso: string, agora: number): string {
  const parte = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "shortOffset" })
    .formatToParts(agora)
    .find((p) => p.type === "timeZoneName")?.value;
  const texto = (parte ?? "GMT").replace("GMT", "UTC").replace("-", "−");
  return texto;
}

export function rotuloDoFuso(fuso: string, agora = Date.now()): string {
  const destaque = FUSOS_DO_BRASIL.find((f) => f.fuso === fuso);
  const utc = deslocamento(fuso, agora);
  return destaque ? `${destaque.nome} (${utc})` : `${fuso} (${utc})`;
}

/** Todos os fusos IANA que o navegador conhece, com o Brasil em destaque no topo. */
export function gruposDeFusos(agora = Date.now()): { grupo: string; fusos: { fuso: string; rotulo: string }[] }[] {
  const todos = Intl.supportedValuesOf("timeZone");
  return [
    { grupo: "Brasil", fusos: FUSOS_DO_BRASIL.map(({ fuso }) => ({ fuso, rotulo: rotuloDoFuso(fuso, agora) })) },
    { grupo: "Todos os fusos", fusos: todos.map((fuso) => ({ fuso, rotulo: rotuloDoFuso(fuso, agora) })) },
  ];
}
