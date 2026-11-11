import { describe, expect, it } from "vitest";
import { expandir, JANELA_MATERIALIZACAO_DIAS, janelaDeMaterializacao, type Serie } from "../src/recorrencia.ts";
import { instanteParaLocal, localParaInstante } from "../src/tempo.ts";
import { congelar } from "./fixtures.ts";

const SP = "America/Sao_Paulo";
const NY = "America/New_York";
const MIN = 60_000;
const DIA = 86_400_000;
const NOVEMBRO = { de: Date.UTC(2026, 10, 1, 3), ate: Date.UTC(2026, 11, 1, 3) }; // novembro local em SP
const chaves = (s: Serie, janela = NOVEMBRO) => expandir(s, janela).map((o) => o.chave);

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

describe("expandir: horário de verão (PD-26)", () => {
  it("hora local num salto da primavera aparece uma vez, com a chave local original", () => {
    // 14/03/2027 em Nova York: 02:30 não existe; vira 03:30 EDT (07:30Z).
    const s = serie({ dtstart: "2027-03-13T02:30", duracaoMin: 60, rrule: "FREQ=DAILY", fuso: NY });
    const ocorrencias = expandir(s, { de: Date.UTC(2027, 2, 13), ate: Date.UTC(2027, 2, 16) });
    expect(ocorrencias.map((o) => o.chave)).toEqual(["2027-03-13T02:30", "2027-03-14T02:30", "2027-03-15T02:30"]);
    expect(ocorrencias.map((o) => o.inicio)).toEqual([
      Date.UTC(2027, 2, 13, 7, 30),
      Date.UTC(2027, 2, 14, 7, 30),
      Date.UTC(2027, 2, 15, 6, 30),
    ]);
  });

  it("hora local repetida na volta do outono aparece uma vez, no primeiro instante", () => {
    // 07/11/2027 em Nova York: 01:30 acontece em EDT (05:30Z) e de novo em EST (06:30Z).
    const s = serie({ dtstart: "2027-11-06T01:30", duracaoMin: 60, rrule: "FREQ=DAILY", fuso: NY });
    const ocorrencias = expandir(s, { de: Date.UTC(2027, 10, 6), ate: Date.UTC(2027, 10, 9) });
    expect(ocorrencias.map((o) => o.chave)).toEqual(["2027-11-06T01:30", "2027-11-07T01:30", "2027-11-08T01:30"]);
    expect(ocorrencias.map((o) => o.inicio)).toEqual([
      Date.UTC(2027, 10, 6, 5, 30),
      Date.UTC(2027, 10, 7, 5, 30),
      Date.UTC(2027, 10, 8, 6, 30),
    ]);
  });
});

describe("expandir: EXDATE, RDATE, COUNT e UNTIL (T2.5)", () => {
  it("C40: semanal com EXDATE pula só aquela data", () => {
    expect(chaves(serie({ exdate: ["2026-11-10T08:00"] }))).toEqual([
      "2026-11-03T08:00",
      "2026-11-17T08:00",
      "2026-11-24T08:00",
    ]);
  });

  it("C40: EXDATE com outra hora no mesmo dia não pula nada (a chave é a hora local)", () => {
    expect(chaves(serie({ exdate: ["2026-11-10T09:00"] }))).toHaveLength(4);
  });

  it("RDATE acrescenta uma data fora da regra; RDATE igual a uma ocorrência não duplica", () => {
    const ocorrencias = expandir(serie({ rdate: ["2026-11-12T14:00", "2026-11-17T08:00"] }), NOVEMBRO);
    expect(ocorrencias.map((o) => o.chave)).toEqual([
      "2026-11-03T08:00",
      "2026-11-10T08:00",
      "2026-11-12T14:00",
      "2026-11-17T08:00",
      "2026-11-24T08:00",
    ]);
    const extra = ocorrencias[2];
    expect(extra).toEqual({
      chave: "2026-11-12T14:00",
      inicio: Date.UTC(2026, 10, 12, 17, 0),
      fim: Date.UTC(2026, 10, 12, 21, 0),
    });
  });

  it("EXDATE também remove uma RDATE com a mesma chave", () => {
    expect(chaves(serie({ rdate: ["2026-11-12T14:00"], exdate: ["2026-11-12T14:00"] }))).toHaveLength(4);
  });

  it("RDATE fora da janela não entra", () => {
    expect(chaves(serie({ rdate: ["2026-12-05T08:00"] }))).toHaveLength(4);
  });

  it("COUNT=3 gera 3; UNTIL inclui o próprio dia", () => {
    expect(chaves(serie({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=3" }))).toEqual([
      "2026-11-03T08:00",
      "2026-11-10T08:00",
      "2026-11-17T08:00",
    ]);
    expect(chaves(serie({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117" }))).toEqual([
      "2026-11-03T08:00",
      "2026-11-10T08:00",
      "2026-11-17T08:00",
    ]);
  });

  it("UNTIL com hora local é inclusivo naquela hora e corta a seguinte", () => {
    expect(chaves(serie({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T080000" }))).toHaveLength(3);
    expect(chaves(serie({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T075900" }))).toHaveLength(2);
  });

  it("COUNT conta desde o DTSTART, não desde o início da janela", () => {
    const janela = { de: Date.UTC(2026, 10, 9), ate: Date.UTC(2026, 11, 1) };
    expect(chaves(serie({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=3" }), janela)).toEqual([
      "2026-11-10T08:00",
      "2026-11-17T08:00",
    ]);
  });
});

describe("janela de materialização (L-004)", () => {
  const diaria = serie({ dtstart: "2026-11-01T08:00", duracaoMin: 60, rrule: "FREQ=DAILY" });

  it("JANELA_MATERIALIZACAO_DIAS é 90 e a janela vai de agora a agora + 90 dias", () => {
    expect(JANELA_MATERIALIZACAO_DIAS).toBe(90);
    const agora = Date.UTC(2026, 10, 1, 12);
    expect(janelaDeMaterializacao(agora)).toEqual({ de: agora, ate: agora + 90 * DIA });
  });

  it("ocorrência que começa exatamente em `de` entra; exatamente em `ate` não entra", () => {
    const agora = localParaInstante("2026-11-02T08:00", SP);
    const ocorrencias = expandir(diaria, janelaDeMaterializacao(agora));
    expect(ocorrencias[0]?.inicio).toBe(agora);
    expect(ocorrencias.at(-1)?.inicio).toBe(agora + 89 * DIA);
    expect(ocorrencias.some((o) => o.inicio === agora + 90 * DIA)).toBe(false);
    expect(ocorrencias).toHaveLength(90);
  });

  it("ocorrência a 89 dias e 23:59 entra; a 90 dias não entra", () => {
    const alvo = localParaInstante("2027-01-31T08:00", SP);
    const dentro = expandir(diaria, janelaDeMaterializacao(alvo - (89 * DIA + 23 * 60 * MIN + 59 * MIN)));
    expect(dentro.at(-1)?.chave).toBe("2027-01-31T08:00");
    const fora = expandir(diaria, janelaDeMaterializacao(alvo - 90 * DIA));
    expect(fora.at(-1)?.chave).toBe("2027-01-30T08:00");
  });
});

describe("expandir: rrule inválida", () => {
  it.each([
    "lixo",
    "",
    "FREQ=FOO",
    "BYDAY=TU",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=WEEKLY;COUNT=0",
    "FREQ=WEEKLY;UNTIL=amanha",
    "FREQ=WEEKLY;UNTIL=20261332",
    "FREQ=WEEKLY;UNTIL=20261117T250000",
    "FREQ=WEEKLY;BYDAY=TU;BYDAY=WE",
    "FREQ=WEEKLY;COUNT=3;UNTIL=20261117",
  ])("%j lança rrule_invalida", (rrule) => {
    expect(() => expandir(serie({ rrule }), NOVEMBRO)).toThrow(new Error("rrule_invalida"));
  });

  it.each([
    "DTSTART:20261103T080000\nRRULE:FREQ=WEEKLY;BYDAY=TU",
    "FREQ=WEEKLY;BYDAY=TU;DTSTART=20261103T080000",
    "FREQ=WEEKLY;BYDAY=TU;TZID=America/Sao_Paulo",
    "FREQ=WEEKLY;BYDAY=TU;BYHOUR=9",
    "FREQ=WEEKLY;BYDAY=TU;BYMINUTE=30",
    "FREQ=WEEKLY;BYDAY=TU;BYSECOND=0",
    "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T080000Z",
    "FREQ=HOURLY",
  ])("PD-26: %j lança rrule_invalida (início, hora e fuso vêm dos campos da série)", (rrule) => {
    expect(() => expandir(serie({ rrule }), NOVEMBRO)).toThrow(new Error("rrule_invalida"));
  });
});
