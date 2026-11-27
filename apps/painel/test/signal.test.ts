import { describe, expect, it } from "vitest";
import { signalBand } from "@/lib/signal";

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 26, 13, 0);
const ago = (min: number) => new Date(NOW - min * MIN).toISOString();
const tv = (id: string, min: number) => ({ kind: "tv" as const, id, name: null, since: ago(min) });
const station = (name: string, min: number) => ({ kind: "station" as const, id: name, name, since: ago(min) });

const TV_TEXT = "Os pacientes não veem as chamadas nem o QR. Confira se ela está ligada e com internet.";
const STATION_TEXT = "A tela da estação está fechada ou sem internet. Se a sala parou, pause ou feche a estação.";

describe("QP2: a faixa de alerta de sinal no painel", () => {
  it("sem alerta, nenhuma faixa", () => {
    expect(signalBand([], NOW)).toBeNull();
  });

  it("a TV: vermelha, com há quanto tempo", () => {
    expect(signalBand([tv("t1", 5)], NOW)).toEqual({ tone: "danger", title: "TV sem sinal há 5 min", text: TV_TEXT });
  });

  it("uma estação: amarela, com há quanto tempo; uma hora ou mais em horas", () => {
    expect(signalBand([station("Consultório 1", 3)], NOW)).toEqual({
      tone: "alert",
      title: "Consultório 1 sem sinal há 3 min",
      text: STATION_TEXT,
    });
    expect(signalBand([station("Consultório 1", 135)], NOW)?.title).toBe("Consultório 1 sem sinal há 2 h");
  });

  it("várias ao mesmo tempo: uma faixa só, sem o tempo; com a TV, vermelha", () => {
    expect(signalBand([tv("t1", 5), station("Consultório 1", 3)], NOW)).toEqual({
      tone: "danger",
      title: "TV e Consultório 1 sem sinal",
      text: TV_TEXT,
    });
    expect(signalBand([station("Sala 1", 4), station("Sala 2", 3), station("Sala 3", 9)], NOW)).toEqual({
      tone: "alert",
      title: "Sala 1, Sala 2 e Sala 3 sem sinal",
      text: "As telas das estações estão fechadas ou sem internet. Se a sala parou, pause ou feche a estação.",
    });
    expect(signalBand([tv("t1", 5), tv("t2", 4)], NOW)).toEqual({
      tone: "danger",
      title: "2 TVs sem sinal",
      text: "Os pacientes não veem as chamadas nem o QR. Confira se elas estão ligadas e com internet.",
    });
  });
});
