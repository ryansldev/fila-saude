import type { SignalAlertOutput } from "@fila-saude/schemas/unit";

/** A faixa de alerta de sinal (QP2): vermelha com a TV no meio, amarela só com estações. */
export type SignalBand = { tone: "danger" | "alert"; title: string; text: string };

const TV_ONE = "Os pacientes não veem as chamadas nem o QR. Confira se ela está ligada e com internet.";
const TV_MANY = "Os pacientes não veem as chamadas nem o QR. Confira se elas estão ligadas e com internet.";
const STATION_ONE = "A tela da estação está fechada ou sem internet. Se a sala parou, pause ou feche a estação.";
const STATION_MANY = "As telas das estações estão fechadas ou sem internet. Se a sala parou, pause ou feche a estação.";

/** "há 3 min"; uma hora ou mais, "há 2 h". */
function elapsed(since: string, now: number): string {
  const min = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  return min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h`;
}

/** "A", "A e B", "A, B e C". */
const joined = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;

/**
 * QP2: o texto da faixa do painel. Um aviso só: o nome e há quanto tempo; vários: uma faixa só com os nomes, sem
 * o tempo. A TV não tem nome ("TV"; duas ou mais, "2 TVs"). Sem alerta, nenhuma faixa.
 */
export function signalBand(alerts: SignalAlertOutput[], now: number): SignalBand | null {
  if (alerts.length === 0) return null;
  const tvs = alerts.filter((a) => a.kind === "tv");
  const stations = alerts.filter((a) => a.kind === "station");
  const tone = tvs.length > 0 ? "danger" : "alert";
  const text = tvs.length > 1 ? TV_MANY : tvs.length === 1 ? TV_ONE : stations.length > 1 ? STATION_MANY : STATION_ONE;
  const [only] = alerts;
  if (alerts.length === 1 && only) {
    return { tone, title: `${only.kind === "tv" ? "TV" : only.name} sem sinal ${elapsed(only.since, now)}`, text };
  }
  const names = [
    ...(tvs.length === 1 ? ["TV"] : tvs.length > 1 ? [`${tvs.length} TVs`] : []),
    ...stations.map((s) => s.name ?? ""),
  ];
  return { tone, title: `${joined(names)} sem sinal`, text };
}
