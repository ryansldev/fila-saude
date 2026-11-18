import { instantToLocal, localToInstant, type ServiceMode } from "@fila-saude/domain";

export type Visibility = "public" | "private";

/** Data e hora digitadas no fuso da unidade → instante ISO (PD-26). */
export function timeForSending(data: string, hour: string, timeZone: string): string {
  return new Date(localToInstant(`${data}T${hour}`, timeZone)).toISOString();
}

export function timeForScreen(iso: string, timeZone: string): { data: string; hour: string } {
  const local = instantToLocal(Date.parse(iso), timeZone);
  return { data: local.slice(0, 10), hour: local.slice(11, 16) };
}

/** RN-PUB-03: privada perde a dispensa. */
export function adjustVisibility(
  current: { visibility: Visibility; waivesPreRegistration: boolean },
  to: Visibility,
): { visibility: Visibility; waivesPreRegistration: boolean } {
  return { visibility: to, waivesPreRegistration: to === "public" ? current.waivesPreRegistration : false };
}

/** Serviço regulado só tem sessão privada. */
export function allowedVisibilities(mode: ServiceMode): Visibility[] {
  return mode === "regulated" ? ["private"] : ["public", "private"];
}

export function serviceStations<E extends { services: string[] }>(stations: E[], serviceId: string): E[] {
  return stations.filter((e) => e.services.includes(serviceId));
}

/** Hoje (AAAA-MM-DD) no fuso da unidade. */
export function todayInTimeZone(timeZone: string, now = Date.now()): string {
  return instantToLocal(now, timeZone).slice(0, 10);
}

/** Intervalo [00:00 do dia, 00:00 do dia seguinte) no fuso, em ISO. */
function dayInterval(data: string, timeZone: string): { from: string; until: string } {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const following = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  return { from: timeForSending(data, "00:00", timeZone), until: timeForSending(following, "00:00", timeZone) };
}

/** A lista de sessões da unidade no dia (no fuso dela). */
export function sessionsOfDayPath(unitId: string, day: string, timeZone: string): string {
  const { from, until } = dayInterval(day, timeZone);
  return `/v1/panel/units/${unitId}/sessions?from=${encodeURIComponent(from)}&until=${encodeURIComponent(until)}`;
}

/** Vagas digitadas: vazio = sem limite; senão inteiro ≥ 1 (antes "1,5" ou "dez" viravam sem limite). */
export function readSlots(text: string): { ok: true; slots: number | null } | { ok: false; error: string } {
  const t = text.trim();
  if (!t) return { ok: true, slots: null };
  if (!/^\d+$/.test(t) || Number(t) < 1)
    return { ok: false, error: "Use um número inteiro (1 ou mais), ou deixe vazio." };
  return { ok: true, slots: Number(t) };
}

/** AAAA-MM-DD de verdade: o campo de data do navegador aceita anos com 5 ou 6 dígitos. */
export function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
}
