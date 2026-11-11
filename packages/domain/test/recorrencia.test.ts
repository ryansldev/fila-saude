import { describe, expect, it } from "vitest";
import { expandir, type Serie } from "../src/recorrencia.ts";
import { instanteParaLocal, localParaInstante } from "../src/tempo.ts";
import { congelar } from "./fixtures.ts";

const SP = "America/Sao_Paulo";
const NY = "America/New_York";
const MIN = 60_000;

const serie = (parcial: Partial<Serie> = {}): Serie => ({
  dtstart: "2026-11-03T08:00",
  duracaoMin: 240,
  rrule: "FREQ=WEEKLY;BYDAY=TU",
  exdate: [],
  rdate: [],
  fuso: SP,
  ...parcial,
});

describe("localParaInstante / instanteParaLocal", () => {
  it("São Paulo é UTC-3: 08:00 local é 11:00Z", () => {
    expect(localParaInstante("2026-11-03T08:00", SP)).toBe(Date.UTC(2026, 10, 3, 11, 0));
    expect(instanteParaLocal(Date.UTC(2026, 10, 3, 11, 0), SP)).toBe("2026-11-03T08:00");
  });

  it("vira o dia: 22:30 local em SP é 01:30Z do dia seguinte", () => {
    expect(localParaInstante("2026-12-31T22:30", SP)).toBe(Date.UTC(2027, 0, 1, 1, 30));
    expect(instanteParaLocal(Date.UTC(2027, 0, 1, 1, 30), SP)).toBe("2026-12-31T22:30");
  });

  it("ida e volta em fuso com horário de verão (antes e depois da troca)", () => {
    for (const local of ["2027-03-13T08:00", "2027-03-15T08:00", "2027-11-06T23:59", "2027-11-08T00:00"]) {
      expect(instanteParaLocal(localParaInstante(local, NY), NY)).toBe(local);
    }
    expect(localParaInstante("2027-03-13T08:00", NY)).toBe(Date.UTC(2027, 2, 13, 13, 0));
    expect(localParaInstante("2027-03-15T08:00", NY)).toBe(Date.UTC(2027, 2, 15, 12, 0));
  });

  it("hora que não existe (salto da primavera) avança pelo tamanho do salto", () => {
    // 14/03/2027 em Nova York: 02:00 EST pula para 03:00 EDT; 02:30 vira 03:30 EDT (07:30Z).
    expect(localParaInstante("2027-03-14T02:30", NY)).toBe(Date.UTC(2027, 2, 14, 7, 30));
  });

  it("hora repetida (volta do outono) fica com o primeiro instante", () => {
    // 07/11/2027 em Nova York: 01:30 acontece em EDT (05:30Z) e de novo em EST (06:30Z).
    expect(localParaInstante("2027-11-07T01:30", NY)).toBe(Date.UTC(2027, 10, 7, 5, 30));
  });

  it("recusa texto fora do formato AAAA-MM-DDTHH:mm", () => {
    expect(() => localParaInstante("2026-11-03 08:00", SP)).toThrow();
    expect(() => localParaInstante("2026-11-03T8:00", SP)).toThrow();
  });
});

describe("expandir", () => {
  it("AD-014: semanal às terças 08:00 em America/Sao_Paulo gera as terças da janela", () => {
    const janela = { de: Date.UTC(2026, 10, 1, 3), ate: Date.UTC(2026, 11, 1, 3) }; // novembro local
    const ocorrencias = expandir(serie(), janela);
    expect(ocorrencias).toEqual(
      [3, 10, 17, 24].map((dia) => ({
        chave: `2026-11-${String(dia).padStart(2, "0")}T08:00`,
        inicio: Date.UTC(2026, 10, dia, 11, 0),
        fim: Date.UTC(2026, 10, dia, 15, 0),
      })),
    );
  });

  it("janela é [de, ate): inclui a que começa em `de`, exclui a que começa em `ate`", () => {
    const terca10 = Date.UTC(2026, 10, 10, 11, 0);
    const terca17 = Date.UTC(2026, 10, 17, 11, 0);
    expect(expandir(serie(), { de: terca10, ate: terca17 }).map((o) => o.chave)).toEqual(["2026-11-10T08:00"]);
    expect(expandir(serie(), { de: terca10 + 1, ate: terca17 + 1 }).map((o) => o.chave)).toEqual(["2026-11-17T08:00"]);
  });

  it("nada antes do DTSTART", () => {
    const janela = { de: Date.UTC(2026, 9, 1), ate: Date.UTC(2026, 10, 11) };
    expect(expandir(serie(), janela).map((o) => o.chave)).toEqual(["2026-11-03T08:00", "2026-11-10T08:00"]);
  });

  it("PD-26: hora local se mantém num fuso com horário de verão", () => {
    const s = serie({ dtstart: "2027-03-02T08:00", duracaoMin: 60, fuso: NY });
    const ocorrencias = expandir(s, { de: Date.UTC(2027, 2, 1), ate: Date.UTC(2027, 2, 24) });
    expect(ocorrencias.map((o) => o.chave)).toEqual([
      "2027-03-02T08:00",
      "2027-03-09T08:00",
      "2027-03-16T08:00",
      "2027-03-23T08:00",
    ]);
    // EST (UTC-5) antes de 14/03; EDT (UTC-4) depois.
    expect(ocorrencias.map((o) => o.inicio)).toEqual([
      Date.UTC(2027, 2, 2, 13, 0),
      Date.UTC(2027, 2, 9, 13, 0),
      Date.UTC(2027, 2, 16, 12, 0),
      Date.UTC(2027, 2, 23, 12, 0),
    ]);
    for (const o of ocorrencias) expect(o.fim - o.inicio).toBe(60 * MIN);
  });

  it("expandir não altera a série recebida", () => {
    const s = congelar(serie({ exdate: ["2026-11-10T08:00"], rdate: ["2026-11-12T08:00"] }));
    expect(() => expandir(s, { de: Date.UTC(2026, 10, 1), ate: Date.UTC(2026, 11, 1) })).not.toThrow();
    expect(s).toEqual(serie({ exdate: ["2026-11-10T08:00"], rdate: ["2026-11-12T08:00"] }));
  });
});
