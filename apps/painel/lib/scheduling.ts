import { eve } from "@fila-saude/domain";

/** Data e hora no fuso da unidade: "qua., 18/11 às 08:00". */
export function whenInTimeZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const week = p("weekday").replace(/\.?$/, ".");
  return `${week}, ${p("day")}/${p("month")} às ${p("hour")}:${p("minute")}`;
}

/** RN-AL-06: quantas vagas a sessão já tem ocupadas. */
export const slotText = (taken: number, slots: number | null): string =>
  slots === null ? `${taken} ${taken === 1 ? "alocado" : "alocados"} · sem limite` : `${taken} de ${slots} vagas`;

export type Tone = "neutral" | "alert" | "ok";

const STATES: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmou", tone: "ok" },
  in_queue: { label: "Na fila", tone: "ok" },
  completed: { label: "Atendida", tone: "ok" },
};

/** RN-CONF-03: alocação pendente fica destacada depois do prazo (24 h ou o início da sessão). */
export function allocatedSituation(a: { state: string; highlighted: boolean }): { label: string; tone: Tone } {
  if (a.state === "allocated")
    return a.highlighted
      ? { label: "Sem resposta: ligar", tone: "alert" }
      : { label: "Aguardando resposta", tone: "neutral" };
  return STATES[a.state] ?? { label: a.state, tone: "neutral" };
}

const LEVELS: Record<string, string> = {
  emergency: "Emergência",
  very_urgent: "Muito urgente",
  urgent: "Urgente",
  attention: "Atenção",
  routine: "Rotina",
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  alert: "bg-amber-100 text-amber-900",
  ok: "bg-emerald-100 text-emerald-800",
};

export type Bar = "confirmed" | "pending" | "free";

/** As barrinhas de vagas da sessão; sem limite de vagas não há o que desenhar (`null`). */
export function slotBars(s: { slots: number | null; confirmed: number; pending: number }): Bar[] | null {
  if (s.slots === null) return null;
  const confirmed = Math.min(s.confirmed, s.slots);
  const pending = Math.min(s.pending, s.slots - confirmed);
  return [
    ...Array<Bar>(confirmed).fill("confirmed"),
    ...Array<Bar>(pending).fill("pending"),
    ...Array<Bar>(s.slots - confirmed - pending).fill("free"),
  ];
}

/**
 * RN-RISCO-01: um selo só por pessoa; "(app)" quando é o sugerido, sem ele quando a triagem confirmou.
 * Rotina sugerida não leva selo: só o risco que muda a ordem chama atenção.
 */
export function riskBadge(r: { level: string; confirmed: boolean }): {
  label: string;
  tone: "alert" | "neutral" | "danger";
} | null {
  if (r.level === "routine" && !r.confirmed) return null;
  const name = LEVELS[r.level] ?? r.level;
  const tone =
    r.level === "emergency" ? "danger" : r.level === "urgent" || r.level === "very_urgent" ? "alert" : "neutral";
  return { label: r.confirmed ? name : `${name} (app)`, tone };
}

/** A linha "por quê" da sugestão: a regra do questionário (menos a de rotina) e os demais motivos. */
export const reasonRow = (risk: { level: string; rule: string }, reasons: string[]): string =>
  [...(risk.level === "routine" ? [] : [risk.rule]), ...reasons].join(" · ");

/** RN-CONF-03: a faixa do topo: quantas pessoas para ligar e quem espera resposta há mais tempo. */
export function pendingChecksSummary(
  items: { name: string; allocatedAt: string }[],
  now: number,
): { total: number; howMany: string; oldest: string } | null {
  if (items.length === 0) return null;
  const oldest = items.reduce((a, b) => (Date.parse(b.allocatedAt) < Date.parse(a.allocatedAt) ? b : a));
  const hours = Math.max(0, Math.floor((now - Date.parse(oldest.allocatedAt)) / 3_600_000));
  const howMany = items.length === 1 ? "1 pessoa para ligar" : `${items.length} pessoas para ligar`;
  return { total: items.length, howMany, oldest: `${oldest.name} sem resposta há ${hours} h` };
}

/** RN-AL-05: até quando dá para alocar (a véspera da sessão, no fuso da unidade): "seg., 16/11". */
export function allocateUntil(start: string, timeZone: string): string {
  return whenInTimeZone(new Date(eve(Date.parse(start), timeZone)).toISOString(), timeZone).split(" às ")[0] ?? "";
}

/**
 * RN-CONF-04 / RN-REM-03: depois de "Recusou". A recusa devolve a pessoa à lista, menos a 2ª recusa de
 * quem foi remanejado, que encerra o pedido; o texto segue o estado que a API devolveu.
 */
export const refusalNotice = (state: string): string =>
  state === "cancelled"
    ? "Recusa registrada. A vaga está livre. Era a 2ª recusa de quem foi remanejado: o pedido foi encerrado."
    : "Recusa registrada. A vaga está livre e a pessoa voltou para a lista.";

/** A lista de ligação mudou (alocar, confirmar, recusar): o contador do menu recarrega na hora. */
export const CALL_LIST_CHANGED = "fila-saude:call-list-changed";
export const announceCallListChange = () => window.dispatchEvent(new Event(CALL_LIST_CHANGED));
