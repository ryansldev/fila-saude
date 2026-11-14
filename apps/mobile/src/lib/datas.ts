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
