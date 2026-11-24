import { callingAt, resumedAt } from "./pause.ts";
import type { SessionDay } from "./queue.ts";

/** RN-SES-05: a unidade com TV e a TV sem sinal por mais de ~2 min caiu (a TV fica sempre na frente). */
export const OUTAGE_SILENCE_MS = 2 * 60_000;
/**
 * Unidade sem TV: só as estações dão sinal, e o navegador pode congelar a aba da estação em segundo plano
 * (o médico no prontuário). Por isso o silêncio precisa ser mais longo para ser queda.
 */
export const NO_TV_SILENCE_MS = 10 * 60_000;
/** Servidor fora do ar por mais de 3 min (a varredura roda a cada minuto, PD-50) é queda; um reinício rápido não. */
export const SWEEP_GAP_MS = 3 * 60_000;

/**
 * O sinal de vida da unidade: se ela tem TV pareada, o último sinal das TVs e o das estações da sessão; e a
 * hora em que o processo do servidor subiu (reiniciado depois do último giro, o servidor esteve fora do ar).
 */
export type UnitSignal = {
  hasTv: boolean;
  tvSignalAt: number | null;
  stationSignalAt: number | null;
  serverStartedAt: number;
};

/** Modo manual (RN-SES-05, AD-043): há uma queda percebida ainda aberta. */
export function inManualMode(day: SessionDay): boolean {
  return (day.outages ?? []).some((o) => o.end === null);
}

/**
 * Sinal recente da unidade, medido no giro da varredura. Mais velho que isso, com alguém chamando, pode ser uma
 * queda que ainda não se confirmou (2 min com TV, 10 sem), e a queda volta no tempo até o último sinal: o
 * atraso espera. A TV grava o sinal a cada 20 s; a estação também, mas a aba em segundo plano pode consultar
 * só uma vez por minuto (até ~80 s de idade com a unidade no ar).
 */
export const TV_FRESH_MS = 45_000;
export const STATION_FRESH_MS = 100_000;
/** Um giro da varredura (PD-50); parada por mais de 2 giros com o servidor no ar, o sinal visto já não vale. */
const SWEEP_MS = 60_000;

/**
 * PV5 (AD-076): a cada giro da varredura, o sistema percebe a queda sozinho e guarda o período no dia, e o
 * relógio do prazo de chegada para durante ele, como na queda registrada pela recepção (RN-CONT-03):
 * - unidade que já deu sinal de vida nesta sessão, com estação chamando e sem sinal: abre a queda desde o
 *   último sinal (modo manual) e a fecha quando o sinal volta ou quando ninguém mais chama. Com uma TV que
 *   já deu sinal nesta sessão, só a TV conta, e 2 min sem ela é queda (sem a TV ninguém vê as
 *   chamadas); sem TV (ou com uma TV que ainda não deu sinal, ou desparelhada), contam as estações, com 10 min
 *   de silêncio. Antes do primeiro sinal a unidade ainda não começou, e sem estação chamando ninguém chama:
 *   não é queda. No primeiro giro depois de o servidor reiniciar as estações ainda não voltaram a dar sinal:
 *   espera o giro seguinte;
 * - servidor reiniciado depois do último giro, fora do ar por mais de 3 min: queda do último giro até este
 *   (o primeiro depois da volta). Um giro só atrasado (servidor no ar) não é queda.
 * Sessão que não está aberta não muda.
 */
export function trackOutage(day: SessionDay, now: number, signal: UnitSignal): SessionDay {
  if (day.state !== "open") return day;
  let outages = day.outages ?? [];
  const open = outages.find((o) => o.end === null);
  const last = day.lastSweepAt;
  const restarted = last !== undefined && signal.serverStartedAt > last;
  if (restarted && !open && signal.serverStartedAt - last > SWEEP_GAP_MS) {
    outages = [...outages, { start: last, end: now }];
  }
  const tvLive = signal.hasTv && signal.tvSignalAt !== null && now - signal.tvSignalAt <= OUTAGE_SILENCE_MS;
  // A TV conta se já deu sinal nesta sessão e ainda tem um (a nova, ainda sem sinal, cede às estações).
  const useTv = signal.hasTv && signal.tvSignalAt !== null && (tvLive || day.tvLiveAt !== undefined);
  const signalAt = useTv ? signal.tvSignalAt : signal.stationSignalAt;
  const silence = useTv ? OUTAGE_SILENCE_MS : NO_TV_SILENCE_MS;
  const calling = callingStations(day, now);
  // Pausa que acabou: o silêncio conta da volta (a aba pode ter ficado fechada na pausa).
  const ref = expectedSince(day, signalAt, now);
  const live = ref !== null && now - ref <= silence;
  const seen = day.liveSignalAt !== undefined;
  if (!live && calling && seen && !open && !restarted) {
    // Não volta para antes do fim da queda anterior (fechada quando ninguém chamava).
    const after = Math.max(...outages.map((o) => o.end ?? 0), 0);
    outages = [...outages, { start: Math.max(ref ?? now, after), end: null }];
  }
  if (open && (live || !calling)) outages = outages.map((o) => (o === open ? { ...o, end: now } : o));
  return {
    ...day,
    outages,
    lastSweepAt: now,
    unitSignalAt: signalAt,
    signalSource: useTv ? "tv" : "stations",
    ...(live ? { liveSignalAt: signalAt as number } : {}),
    ...(tvLive ? { tvLiveAt: signal.tvSignalAt as number } : {}),
  };
}

// Estação em pausa ou fechada não chama: o silêncio dela não é queda (QP6).
const calling = (day: SessionDay, now: number) =>
  day.stations.filter((e) => e.services.includes(day.serviceId) && callingAt(day, e, now));
const callingStations = (day: SessionDay, now: number) => calling(day, now).length > 0;

/**
 * Desde quando a unidade devia dar sinal: o último sinal, ou a volta da pausa, se veio depois (desde que a
 * primeira estação voltou a chamar). Nulo sem sinal e sem pausa.
 */
function expectedSince(day: SessionDay, signalAt: number | null, now: number): number | null {
  const since = Math.min(...calling(day, now).map((e) => resumedAt(day, e, now)));
  const ref = Math.max(signalAt ?? Number.NEGATIVE_INFINITY, since);
  return Number.isFinite(ref) ? ref : null;
}

/**
 * Queda ainda não confirmada: o sinal que conta está parado, alguém chama e a unidade já deu sinal nesta sessão.
 * Pode virar queda que volta no tempo e estende o prazo; até lá, o atraso não é julgado (PV5). Entre dois giros
 * o sinal guardado envelhece sem a unidade ter caído, então é parado se: no giro já passava do limite da fonte;
 * agora passa do limite e mais um giro (caiu logo depois do giro); ou a varredura parou há mais de 2 giros.
 * Um sinal que volta entre dois giros só conta no giro seguinte.
 */
export function pendingOutage(day: SessionDay, now: number): boolean {
  const at = day.unitSignalAt;
  const sweep = day.lastSweepAt;
  if (at === undefined || sweep === undefined || inManualMode(day) || day.liveSignalAt === undefined) return false;
  if (!callingStations(day, now)) return false;
  const ref = expectedSince(day, at, now);
  if (ref === null) return true;
  // Dia salvo antes de guardar a fonte: o limite das estações, o mais longo.
  const fresh = day.signalSource === "tv" ? TV_FRESH_MS : STATION_FRESH_MS;
  return sweep - ref > fresh || now - ref > fresh + SWEEP_MS || now - sweep > 2 * SWEEP_MS;
}

/** O fim da sessão (encerrada ou cancelada) fecha a queda aberta: o dia que acabou não fica em modo manual. */
export function endOutages(day: SessionDay, now: number): SessionDay {
  if (!inManualMode(day)) return day;
  return { ...day, outages: (day.outages ?? []).map((o) => (o.end === null ? { ...o, end: now } : o)) };
}
