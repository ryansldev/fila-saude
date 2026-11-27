import { describe, expect, it } from "vitest";
import { type OpenSession, STATION_ALERT_MS, signalAlerts, TV_ALERT_MS } from "../src/signal-alerts.ts";
import { dayWith, freeze } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);
/** A sessão abriu às 9h. */
const START = T - 60 * MIN;
/** Marcada até as 13h. */
const END = T + 3 * 60 * MIN;
const open = (day = dayWith(["ana"])): OpenSession => ({ day, start: START, end: END });

describe("QP2: alerta de sinal da TV e das estações no painel", () => {
  it("sem sessão aberta, nada (a TV e as estações podem estar desligadas)", () => {
    expect(signalAlerts({ sessions: [], tvs: [{ id: "tv1", signalAt: null }], stations: [], now: T })).toEqual([]);
    const closed = open(dayWith(["ana"], { state: "closed" }));
    expect(signalAlerts({ sessions: [closed], tvs: [{ id: "tv1", signalAt: null }], stations: [], now: T })).toEqual(
      [],
    );
  });

  it("TV sem sinal por mais de 2 min: alerta desde o último sinal; até 2 min, não", () => {
    const at = (signalAt: number) =>
      signalAlerts({ sessions: [open()], tvs: [{ id: "tv1", signalAt }], stations: [], now: T });
    expect(at(T - TV_ALERT_MS)).toEqual([]);
    expect(at(T - 3 * MIN)).toEqual([{ kind: "tv", id: "tv1", since: T - 3 * MIN }]);
  });

  it("sinal de antes da sessão (ou nenhum): o silêncio conta da abertura", () => {
    const alerts = signalAlerts({
      sessions: [open()],
      tvs: [
        { id: "tv1", signalAt: START - 12 * 60 * MIN },
        { id: "tv2", signalAt: null },
      ],
      stations: [{ id: "e1", signalAt: null }],
      now: T,
    });
    expect(alerts).toEqual([
      { kind: "tv", id: "tv1", since: START },
      { kind: "tv", id: "tv2", since: START },
      { kind: "station", id: "e1", since: START },
    ]);
  });

  it("estação aberta e fora de pausa sem sinal por mais de 3 min; até 3 min, não", () => {
    const at = (signalAt: number) =>
      signalAlerts({ sessions: [open()], tvs: [], stations: [{ id: "e1", signalAt }], now: T });
    expect(at(T - STATION_ALERT_MS)).toEqual([]);
    expect(at(T - 4 * MIN)).toEqual([{ kind: "station", id: "e1", since: T - 4 * MIN }]);
  });

  it("estação fechada ou em pausa não alerta (o silêncio é esperado, QP6)", () => {
    const base = dayWith(["ana"]);
    const [e1] = base.stations;
    if (!e1) throw new Error("sem estação");
    const closed = freeze({ ...base, stations: [{ ...e1, open: false, closedAt: T - 30 * MIN }] });
    const paused = freeze({
      ...base,
      stations: [{ ...e1, pause: { state: "paused" as const, since: T - 30 * MIN, until: null } }],
    });
    const inBreak = freeze({ ...base, breaks: [{ start: T - 30 * MIN, end: T + 30 * MIN }] });
    for (const day of [closed, paused, inBreak]) {
      expect(
        signalAlerts({ sessions: [open(day)], tvs: [], stations: [{ id: "e1", signalAt: T - 20 * MIN }], now: T }),
      ).toEqual([]);
    }
  });

  it("estação que voltou da pausa: o silêncio conta da volta", () => {
    const base = dayWith(["ana"]);
    const [e1] = base.stations;
    if (!e1) throw new Error("sem estação");
    const back = freeze({ ...base, stations: [{ ...e1, stops: [{ start: T - 40 * MIN, end: T - 2 * MIN }] }] });
    const at = (now: number) =>
      signalAlerts({ sessions: [open(back)], tvs: [], stations: [{ id: "e1", signalAt: T - 40 * MIN }], now });
    expect(at(T)).toEqual([]);
    expect(at(T + 2 * MIN)).toEqual([{ kind: "station", id: "e1", since: T - 2 * MIN }]);
  });

  it("estação que não atende o serviço da sessão aberta não alerta", () => {
    expect(signalAlerts({ sessions: [open()], tvs: [], stations: [{ id: "e9", signalAt: null }], now: T })).toEqual([]);
  });

  it("estação em duas sessões abertas: alerta uma vez, desde a volta mais recente", () => {
    const base = dayWith(["ana"]);
    const [e1] = base.stations;
    if (!e1) throw new Error("sem estação");
    const other = freeze({
      ...base,
      sessionId: "s2",
      stations: [{ ...e1, stops: [{ start: T - 20 * MIN, end: T - 10 * MIN }] }],
    });
    expect(
      signalAlerts({
        sessions: [open(), open(other)],
        tvs: [],
        stations: [{ id: "e1", signalAt: T - 30 * MIN }],
        now: T,
      }),
    ).toEqual([{ kind: "station", id: "e1", since: T - 10 * MIN }]);
  });

  it("sessão aberta depois da hora marcada: o silêncio conta da abertura de verdade", () => {
    const late = dayWith(["ana"], { openedAt: T - 2 * MIN });
    expect(
      signalAlerts({ sessions: [open(late)], tvs: [{ id: "tv1", signalAt: null }], stations: [], now: T }),
    ).toEqual([]);
    expect(
      signalAlerts({ sessions: [open(late)], tvs: [{ id: "tv1", signalAt: null }], stations: [], now: T + 2 * MIN }),
    ).toEqual([{ kind: "tv", id: "tv1", since: T - 2 * MIN }]);
  });

  it("estação com paciente chamado no intervalo ou em pausa não alerta", () => {
    const base = dayWith(["ana"]);
    const [e1] = base.stations;
    if (!e1) throw new Error("sem estação");
    const busy = { ...e1, calledItemId: "ana" };
    const inBreak = freeze({ ...base, stations: [busy], breaks: [{ start: T - 30 * MIN, end: T + 30 * MIN }] });
    const paused = freeze({
      ...base,
      stations: [{ ...busy, pause: { state: "paused" as const, since: T - 30 * MIN, until: null } }],
    });
    for (const day of [inBreak, paused]) {
      expect(
        signalAlerts({ sessions: [open(day)], tvs: [], stations: [{ id: "e1", signalAt: T - 20 * MIN }], now: T }),
      ).toEqual([]);
    }
  });

  it("sessão que passou do fim marcado e ninguém encerrou (ex.: a de ontem) não conta", () => {
    const tvs = [{ id: "tv1", signalAt: null }];
    const stations = [{ id: "e1", signalAt: null }];
    expect(signalAlerts({ sessions: [open()], tvs, stations, now: END })).toEqual([]);
    expect(signalAlerts({ sessions: [open()], tvs, stations, now: END - MIN })).toHaveLength(2);
  });
});
