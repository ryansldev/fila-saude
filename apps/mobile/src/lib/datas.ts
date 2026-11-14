const FUSO = "America/Sao_Paulo";

/** "quinta, 12/11" (design do app). */
export function diaCurto(iso: string, fuso = FUSO): string {
  const d = new Date(iso);
  const semana = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: fuso }).split("-")[0] ?? "";
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: fuso });
  return `${semana.toLowerCase()}, ${data}`;
}

/** "7h" ou "7h30". */
export function hora(iso: string, fuso = FUSO): string {
  const [h = "0", m = "00"] = new Date(iso)
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso, hour12: false })
    .split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const diaNoFuso = (ms: number, fuso: string) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: fuso });

/** O dia de `iso` é o mesmo de `agora` no fuso da unidade? */
export function ehHoje(iso: string, agora: number, fuso = FUSO): boolean {
  return diaNoFuso(Date.parse(iso), fuso) === diaNoFuso(agora, fuso);
}

const UM_DIA = 24 * 60 * 60 * 1000;

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Bloco de data dos cartões: "hoje" / "amanhã" / "qua" em cima, "18" grande, "nov" embaixo. */
export function partesDoDia(iso: string, agora: number, fuso = FUSO): { topo: string; dia: string; mes: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, weekday: "short", day: "numeric", month: "numeric" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  const semana = SEMANA[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday ?? "")] ?? "";
  const topo = ehHoje(iso, agora, fuso) ? "hoje" : ehHoje(iso, agora + UM_DIA, fuso) ? "amanhã" : semana;
  return { topo, dia: String(p.day), mes: MESES[Number(p.month) - 1] ?? "" };
}

/**
 * Cumprimento do Dr. (mascote) pelo horário em Brasília: bom dia até 11h, boa tarde até 17h, boa noite
 * o resto.
 */
export function cumprimentoDoDia(agora: number, fuso = FUSO): "bom dia" | "boa tarde" | "boa noite" {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, hour: "numeric", hour12: false })
      .formatToParts(new Date(agora))
      .find((p) => p.type === "hour")?.value ?? "12",
  );
  // Alguns motores devolvem 24 à meia-noite.
  const hora = h === 24 ? 0 : h;
  if (hora >= 5 && hora < 12) return "bom dia";
  if (hora >= 12 && hora < 18) return "boa tarde";
  return "boa noite";
}

/** "hoje, das 14h às 18h", "amanhã, das 8h às 12h30" ou "quarta, 18/11, das 8h às 12h". */
export function janelaDoAtendimento(inicio: string, fim: string, agora: number, fuso = FUSO): string {
  const dia = ehHoje(inicio, agora, fuso)
    ? "hoje"
    : ehHoje(inicio, agora + UM_DIA, fuso)
      ? "amanhã"
      : diaCurto(inicio, fuso);
  return `${dia}, das ${hora(inicio, fuso)} às ${hora(fim, fuso)}`;
}
