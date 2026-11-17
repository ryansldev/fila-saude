import { dayParts } from "@/lib/dates";

const TIME_ZONE = "America/Sao_Paulo";
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const LONG_WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Um botão da faixa de dias da unidade. `chave` é o dia no fuso ("2026-11-16"). */
export type StripDay = { key: string; top: string; day: string; monthYear: string };

/** "2026-11-16": o dia de `iso` no fuso da unidade. */
export function dayKey(iso: string, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const parts = (key: string) => {
  const [a, m, d] = key.split("-").map(Number);
  return { year: a ?? 0, month: m ?? 1, day: d ?? 1 };
};

/** "novembro de 2026". */
export function monthYear(key: string): string {
  const { year, month } = parts(key);
  return `${MONTHS[month - 1]} de ${year}`;
}

/** "quarta, 25 de novembro". */
export function longDay(key: string): string {
  const { year, month, day } = parts(key);
  const week = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${LONG_WEEK[week]}, ${day} de ${MONTHS[month - 1]}`;
}

/** Os dias que têm atendimento, um por dia, em ordem (a faixa pula os dias vazios). */
export function daysWithCare(starts: string[], now: number, timeZone = TIME_ZONE): StripDay[] {
  const byDay = new Map<string, string>();
  for (const i of [...starts].sort()) {
    const key = dayKey(i, timeZone);
    if (!byDay.has(key)) byDay.set(key, i);
  }
  return [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, iso]) => {
      const p = dayParts(iso, now, timeZone);
      return { key, top: p.top, day: p.day, monthYear: monthYear(key) };
    });
}

export type MonthCell = { key: string; day: number; has: boolean; today: boolean } | null;

/** O mês em semanas de domingo a sábado (`null` fora do mês), com os dias que têm atendimento. */
export function monthGrid(year: number, month: number, withCare: Set<string>, today: string): MonthCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: MonthCell[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= total; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key, day: d, has: withCare.has(key), today: key === today });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** O dia escolhido, se ainda tem atendimento; senão, o primeiro da faixa. */
export function validDay(chosen: string | null, days: StripDay[]): string | null {
  if (chosen && days.some((d) => d.key === chosen)) return chosen;
  return days[0]?.key ?? null;
}
