import { pausedAt, resumedAt } from "./pause-time.ts";
import type { SessionDay } from "./queue.ts";

/** QP2: a TV sem sinal por mais de 2 min entra no alerta (o mesmo silêncio que é queda com TV, RN-SES-05). */
export const TV_ALERT_MS = 2 * 60_000;
/**
 * A estação grava o sinal a cada ~20 s, mas a aba em segundo plano pode consultar só uma vez por minuto (até
 * ~80 s com a tela no ar): 3 min sem sinal já é a tela fechada ou sem internet.
 */
export const STATION_ALERT_MS = 3 * 60_000;

/**
 * Uma sessão aberta da unidade: o dia, a hora de início marcada (vale só nos dias gravados antes de `openedAt`;
 * antes da abertura, ninguém devia dar sinal) e o fim marcado (depois dele, a sessão esquecida aberta não conta).
 */
export type OpenSession = { day: SessionDay; start: number; end: number };

export type SignalAlert = { kind: "tv" | "station"; id: string; since: number };

/**
 * QP2 (AD-076): o que está sem sinal na unidade, para a faixa do painel. Só com sessão aberta e antes do fim marcado
 * (fora dela a TV e as estações podem estar desligadas; a sessão de ontem esquecida aberta não conta). A TV pareada conta sempre; a estação, se está aberta e chamando (fora de
 * pausa e do intervalo) em alguma sessão aberta que atende, porque o silêncio da pausa é esperado (QP6). O
 * silêncio conta do último sinal, da abertura da sessão ou da volta da pausa, o que veio por último.
 */
export function signalAlerts(input: {
  sessions: OpenSession[];
  tvs: { id: string; signalAt: number | null }[];
  stations: { id: string; signalAt: number | null }[];
  now: number;
}): SignalAlert[] {
  const { now } = input;
  const sessions = input.sessions
    .filter((s) => s.day.state === "open" && now < s.end)
    .map((s) => ({ day: s.day, start: s.day.openedAt ?? s.start }));
  if (sessions.length === 0) return [];
  const opened = Math.min(...sessions.map((s) => s.start));
  const alerts: SignalAlert[] = [];
  for (const t of input.tvs) {
    const since = Math.max(t.signalAt ?? opened, opened);
    if (now - since > TV_ALERT_MS) alerts.push({ kind: "tv", id: t.id, since });
  }
  for (const st of input.stations) {
    const refs = sessions.flatMap(({ day, start }) => {
      const e = day.stations.find((x) => x.id === st.id);
      // Com paciente chamado no intervalo ou na pausa, a estação também não precisa dar sinal.
      if (!e?.open || !e.services.includes(day.serviceId) || pausedAt(day, e, now)) return [];
      return [Math.max(st.signalAt ?? start, start, resumedAt(day, e, now))];
    });
    if (refs.length === 0) continue;
    const since = Math.max(...refs);
    if (now - since > STATION_ALERT_MS) alerts.push({ kind: "station", id: st.id, since });
  }
  return alerts;
}
