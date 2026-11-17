export type Interval = { opens: string; closes: string };
export type DayKey = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type Time = Partial<Record<DayKey, Interval[]>>;

/** Dias na ordem da semana de trabalho (segunda primeiro); a chave é a da API (0 = domingo). */
export const DAYS: { key: DayKey; name: string; short: string }[] = [
  { key: "1", name: "Segunda", short: "Seg" },
  { key: "2", name: "Terça", short: "Ter" },
  { key: "3", name: "Quarta", short: "Qua" },
  { key: "4", name: "Quinta", short: "Qui" },
  { key: "5", name: "Sexta", short: "Sex" },
  { key: "6", name: "Sábado", short: "Sáb" },
  { key: "0", name: "Domingo", short: "Dom" },
];

export const DEFAULT_TIME: Time = Object.fromEntries(
  (["1", "2", "3", "4", "5"] as DayKey[]).map((d) => [d, [{ opens: "07:00", closes: "17:00" }]]),
);

const minutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Novo intervalo: 1 h depois do fim do último (até 4 h de duração); no dia vazio, 07:00–12:00. */
export function addInterval(h: Time, day: DayKey): Time {
  const current = h[day] ?? [];
  const last = current.at(-1);
  if (!last) return { ...h, [day]: [{ opens: "07:00", closes: "12:00" }] };
  const start = Math.min(minutes(last.closes) + 60, 23 * 60);
  const end = Math.min(start + 4 * 60, 23 * 60 + 59);
  return { ...h, [day]: [...current, { opens: hhmm(start), closes: hhmm(end) }] };
}

/** Erros por intervalo (`horario.<dia>.<índice>`), os mesmos que a API recusaria. */
export function timeProblems(h: Time): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [day, list] of Object.entries(h)) {
    (list ?? []).forEach((iv, i) => {
      if (iv.closes <= iv.opens) errors[`horario.${day}.${i}`] = "O fim deve ser depois do início.";
    });
    (list ?? []).forEach((iv, i) => {
      if (errors[`horario.${day}.${i}`]) return;
      const overrides = (list ?? []).some((other, j) => j < i && iv.opens < other.closes && other.opens < iv.closes);
      if (overrides) errors[`horario.${day}.${i}`] = "Sobrepõe outro intervalo do dia.";
    });
  }
  return errors;
}

const dayText = (list: Interval[] | undefined) =>
  [...(list ?? [])]
    .sort((a, b) => a.opens.localeCompare(b.opens))
    .map((iv) => `${iv.opens}–${iv.closes}`)
    .join(", ");

/** "Seg a Sex 07:00–17:00 · Sáb 08:00–12:00": dias seguidos com o mesmo horário viram uma faixa. */
export function timeSummary(h: Time): string {
  const parts: string[] = [];
  let i = 0;
  while (i < DAYS.length) {
    const text = dayText(h[DAYS[i]?.key as DayKey]);
    let j = i;
    while (j + 1 < DAYS.length && dayText(h[DAYS[j + 1]?.key as DayKey]) === text) j++;
    if (text) parts.push(`${DAYS[i]?.short}${j > i ? ` a ${DAYS[j]?.short}` : ""} ${text}`);
    i = j + 1;
  }
  return parts.length > 0 ? parts.join(" · ") : "Sem horário definido";
}
