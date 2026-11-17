const TIME_ZONE = "America/Sao_Paulo";

/** "quinta, 12/11" (design do app). */
export function shortDay(iso: string, timeZone = TIME_ZONE): string {
  const d = new Date(iso);
  const week = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: timeZone }).split("-")[0] ?? "";
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: timeZone });
  return `${week.toLowerCase()}, ${data}`;
}

/** "7h" ou "7h30". */
export function hour(iso: string, timeZone = TIME_ZONE): string {
  const [h = "0", m = "00"] = new Date(iso)
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timeZone, hour12: false })
    .split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const dayInTimeZone = (ms: number, timeZone: string) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timeZone });

/** O dia de `iso` é o mesmo de `agora` no fuso da unidade? */
export function isToday(iso: string, now: number, timeZone = TIME_ZONE): boolean {
  return dayInTimeZone(Date.parse(iso), timeZone) === dayInTimeZone(now, timeZone);
}

const ONE_DAY = 24 * 60 * 60 * 1000;

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Bloco de data dos cartões: "hoje" / "amanhã" / "qua" em cima, "18" grande, "nov" embaixo. */
export function dayParts(iso: string, now: number, timeZone = TIME_ZONE): { top: string; day: string; month: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone, weekday: "short", day: "numeric", month: "numeric" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  const week = WEEK[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday ?? "")] ?? "";
  const top = isToday(iso, now, timeZone) ? "hoje" : isToday(iso, now + ONE_DAY, timeZone) ? "amanhã" : week;
  return { top, day: String(p.day), month: MONTHS[Number(p.month) - 1] ?? "" };
}

/**
 * Cumprimento do Dr. (mascote) pelo horário em Brasília: bom dia até 11h, boa tarde até 17h, boa noite
 * o resto.
 */
export function dayGreeting(now: number, timeZone = TIME_ZONE): "bom dia" | "boa tarde" | "boa noite" {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone, hour: "numeric", hour12: false })
      .formatToParts(new Date(now))
      .find((p) => p.type === "hour")?.value ?? "12",
  );
  // Alguns motores devolvem 24 à meia-noite.
  const hour = h === 24 ? 0 : h;
  if (hour >= 5 && hour < 12) return "bom dia";
  if (hour >= 12 && hour < 18) return "boa tarde";
  return "boa noite";
}

/** "hoje, das 14h às 18h", "amanhã, das 8h às 12h30" ou "quarta, 18/11, das 8h às 12h". */
export function careWindow(start: string, end: string, now: number, timeZone = TIME_ZONE): string {
  const day = isToday(start, now, timeZone)
    ? "hoje"
    : isToday(start, now + ONE_DAY, timeZone)
      ? "amanhã"
      : shortDay(start, timeZone);
  return `${day}, das ${hour(start, timeZone)} às ${hour(end, timeZone)}`;
}
