import type { SessionDay } from "./queue.ts";

/** RN-SES-05: a unidade sem sinal da TV e das estações abertas por mais de ~2 min caiu. */
export const OUTAGE_SILENCE_MS = 2 * 60_000;
/** Servidor fora do ar por mais de 3 min (a varredura roda a cada minuto, PD-50) é queda; um reinício rápido não. */
export const SWEEP_GAP_MS = 3 * 60_000;

/**
 * O último sinal de vida da unidade (TVs pareadas e estações da sessão) e a hora em que o processo do
 * servidor subiu: reiniciado depois do último giro, o servidor esteve fora do ar.
 */
export type UnitSignal = { lastSignalAt: number | null; serverStartedAt: number };

/** Modo manual (RN-SES-05, AD-043): há uma queda percebida ainda aberta. */
export function inManualMode(day: SessionDay): boolean {
  return (day.outages ?? []).some((o) => o.end === null);
}

/**
 * PV5 (AD-076): a cada giro da varredura, o sistema percebe a queda sozinho e guarda o período no dia, e o
 * relógio do prazo de chegada para durante ele, como na queda registrada pela recepção (RN-CONT-03):
 * - unidade que já deu sinal de vida nesta sessão, com estação aberta e sem sinal por mais de 2 min: abre a
 *   queda desde o último sinal (modo manual) e a fecha quando o sinal volta. Antes do primeiro sinal a
 *   unidade ainda não começou (ninguém abriu a estação), e sem estação aberta ninguém chama: não é queda.
 *   No primeiro giro depois de o servidor reiniciar as estações ainda não voltaram a dar sinal: espera o
 *   giro seguinte;
 * - servidor reiniciado depois do último giro, fora do ar por mais de 3 min: queda do último giro até a
 *   hora em que subiu. Um giro só atrasado (servidor no ar) não é queda.
 * Sessão que não está aberta não muda.
 */
export function trackOutage(day: SessionDay, now: number, signal: UnitSignal): SessionDay {
  if (day.state !== "open") return day;
  let outages = day.outages ?? [];
  const open = outages.find((o) => o.end === null);
  const last = day.lastSweepAt;
  const restarted = last !== undefined && signal.serverStartedAt > last;
  if (restarted && !open && signal.serverStartedAt - last > SWEEP_GAP_MS) {
    outages = [...outages, { start: last, end: signal.serverStartedAt }];
  }
  const signalAt = signal.lastSignalAt;
  const live = signalAt !== null && now - signalAt <= OUTAGE_SILENCE_MS;
  const calling = day.stations.some((e) => e.open && e.services.includes(day.serviceId));
  const seen = day.liveSignalAt !== undefined;
  if (!live && calling && seen && !open && !restarted) outages = [...outages, { start: signalAt ?? now, end: null }];
  if (live && open) outages = outages.map((o) => (o === open ? { ...o, end: now } : o));
  return {
    ...day,
    outages,
    lastSweepAt: now,
    ...(live ? { liveSignalAt: signalAt } : {}),
  };
}

/** O fim da sessão (encerrada ou cancelada) fecha a queda aberta: o dia que acabou não fica em modo manual. */
export function endOutages(day: SessionDay, now: number): SessionDay {
  if (!inManualMode(day)) return day;
  return { ...day, outages: (day.outages ?? []).map((o) => (o.end === null ? { ...o, end: now } : o)) };
}
