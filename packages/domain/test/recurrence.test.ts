import { describe, expect, it } from "vitest";
import {
  expand,
  MATERIALIZATION_WINDOW_DAYS,
  materializationWindow,
  newOccurrences,
  type Series,
  separateMaterialized,
  splitSeries,
} from "../src/recurrence.ts";
import { instantToLocal, localToInstant } from "../src/time.ts";
import { freeze } from "./fixtures.ts";

const SP = "America/Sao_Paulo";
const NY = "America/New_York";
const MIN = 60_000;
const DAY = 86_400_000;
const NOVEMBER = { de: Date.UTC(2026, 10, 1, 3), until: Date.UTC(2026, 11, 1, 3) }; // novembro local em SP
const keys = (s: Series, window = NOVEMBER) => expand(s, window).map((o) => o.key);

const series = (partial: Partial<Series> = {}): Series => ({
  dtstart: "2026-11-03T08:00",
  durationMin: 240,
  rrule: "FREQ=WEEKLY;BYDAY=TU",
  exdate: [],
  rdate: [],
  timeZone: SP,
  ...partial,
});

describe("localParaInstante / instanteParaLocal", () => {
  it("São Paulo é UTC-3: 08:00 local é 11:00Z", () => {
    expect(localToInstant("2026-11-03T08:00", SP)).toBe(Date.UTC(2026, 10, 3, 11, 0));
    expect(instantToLocal(Date.UTC(2026, 10, 3, 11, 0), SP)).toBe("2026-11-03T08:00");
  });

  it("vira o dia: 22:30 local em SP é 01:30Z do dia seguinte", () => {
    expect(localToInstant("2026-12-31T22:30", SP)).toBe(Date.UTC(2027, 0, 1, 1, 30));
    expect(instantToLocal(Date.UTC(2027, 0, 1, 1, 30), SP)).toBe("2026-12-31T22:30");
  });

  it("ida e volta em fuso com horário de verão (antes e depois da troca)", () => {
    for (const local of ["2027-03-13T08:00", "2027-03-15T08:00", "2027-11-06T23:59", "2027-11-08T00:00"]) {
      expect(instantToLocal(localToInstant(local, NY), NY)).toBe(local);
    }
    expect(localToInstant("2027-03-13T08:00", NY)).toBe(Date.UTC(2027, 2, 13, 13, 0));
    expect(localToInstant("2027-03-15T08:00", NY)).toBe(Date.UTC(2027, 2, 15, 12, 0));
  });

  it("hora que não existe (salto da primavera) avança pelo tamanho do salto", () => {
    // 14/03/2027 em Nova York: 02:00 EST pula para 03:00 EDT; 02:30 vira 03:30 EDT (07:30Z).
    expect(localToInstant("2027-03-14T02:30", NY)).toBe(Date.UTC(2027, 2, 14, 7, 30));
  });

  it("hora repetida (volta do outono) fica com o primeiro instante", () => {
    // 07/11/2027 em Nova York: 01:30 acontece em EDT (05:30Z) e de novo em EST (06:30Z).
    expect(localToInstant("2027-11-07T01:30", NY)).toBe(Date.UTC(2027, 10, 7, 5, 30));
  });

  it("recusa texto fora do formato AAAA-MM-DDTHH:mm", () => {
    expect(() => localToInstant("2026-11-03 08:00", SP)).toThrow();
    expect(() => localToInstant("2026-11-03T8:00", SP)).toThrow();
  });
});

describe("expandir", () => {
  it("AD-014: semanal às terças 08:00 em America/Sao_Paulo gera as terças da janela", () => {
    const window = { de: Date.UTC(2026, 10, 1, 3), until: Date.UTC(2026, 11, 1, 3) }; // novembro local
    const occurrences = expand(series(), window);
    expect(occurrences).toEqual(
      [3, 10, 17, 24].map((day) => ({
        key: `2026-11-${String(day).padStart(2, "0")}T08:00`,
        start: Date.UTC(2026, 10, day, 11, 0),
        end: Date.UTC(2026, 10, day, 15, 0),
      })),
    );
  });

  it("janela é [de, ate): inclui a que começa em `de`, exclui a que começa em `ate`", () => {
    const tuesday10 = Date.UTC(2026, 10, 10, 11, 0);
    const tuesday17 = Date.UTC(2026, 10, 17, 11, 0);
    expect(expand(series(), { de: tuesday10, until: tuesday17 }).map((o) => o.key)).toEqual(["2026-11-10T08:00"]);
    expect(expand(series(), { de: tuesday10 + 1, until: tuesday17 + 1 }).map((o) => o.key)).toEqual([
      "2026-11-17T08:00",
    ]);
  });

  it("nada antes do DTSTART", () => {
    const window = { de: Date.UTC(2026, 9, 1), until: Date.UTC(2026, 10, 11) };
    expect(expand(series(), window).map((o) => o.key)).toEqual(["2026-11-03T08:00", "2026-11-10T08:00"]);
  });

  it("PD-26: hora local se mantém num fuso com horário de verão", () => {
    const s = series({ dtstart: "2027-03-02T08:00", durationMin: 60, timeZone: NY });
    const occurrences = expand(s, { de: Date.UTC(2027, 2, 1), until: Date.UTC(2027, 2, 24) });
    expect(occurrences.map((o) => o.key)).toEqual([
      "2027-03-02T08:00",
      "2027-03-09T08:00",
      "2027-03-16T08:00",
      "2027-03-23T08:00",
    ]);
    // EST (UTC-5) antes de 14/03; EDT (UTC-4) depois.
    expect(occurrences.map((o) => o.start)).toEqual([
      Date.UTC(2027, 2, 2, 13, 0),
      Date.UTC(2027, 2, 9, 13, 0),
      Date.UTC(2027, 2, 16, 12, 0),
      Date.UTC(2027, 2, 23, 12, 0),
    ]);
    for (const o of occurrences) expect(o.end - o.start).toBe(60 * MIN);
  });

  it("expandir não altera a série recebida", () => {
    const s = freeze(series({ exdate: ["2026-11-10T08:00"], rdate: ["2026-11-12T08:00"] }));
    expect(() => expand(s, { de: Date.UTC(2026, 10, 1), until: Date.UTC(2026, 11, 1) })).not.toThrow();
    expect(s).toEqual(series({ exdate: ["2026-11-10T08:00"], rdate: ["2026-11-12T08:00"] }));
  });
});

describe("expandir: horário de verão (PD-26)", () => {
  it("hora local num salto da primavera aparece uma vez, com a chave local original", () => {
    // 14/03/2027 em Nova York: 02:30 não existe; vira 03:30 EDT (07:30Z).
    const s = series({ dtstart: "2027-03-13T02:30", durationMin: 60, rrule: "FREQ=DAILY", timeZone: NY });
    const occurrences = expand(s, { de: Date.UTC(2027, 2, 13), until: Date.UTC(2027, 2, 16) });
    expect(occurrences.map((o) => o.key)).toEqual(["2027-03-13T02:30", "2027-03-14T02:30", "2027-03-15T02:30"]);
    expect(occurrences.map((o) => o.start)).toEqual([
      Date.UTC(2027, 2, 13, 7, 30),
      Date.UTC(2027, 2, 14, 7, 30),
      Date.UTC(2027, 2, 15, 6, 30),
    ]);
  });

  it("hora local repetida na volta do outono aparece uma vez, no primeiro instante", () => {
    // 07/11/2027 em Nova York: 01:30 acontece em EDT (05:30Z) e de novo em EST (06:30Z).
    const s = series({ dtstart: "2027-11-06T01:30", durationMin: 60, rrule: "FREQ=DAILY", timeZone: NY });
    const occurrences = expand(s, { de: Date.UTC(2027, 10, 6), until: Date.UTC(2027, 10, 9) });
    expect(occurrences.map((o) => o.key)).toEqual(["2027-11-06T01:30", "2027-11-07T01:30", "2027-11-08T01:30"]);
    expect(occurrences.map((o) => o.start)).toEqual([
      Date.UTC(2027, 10, 6, 5, 30),
      Date.UTC(2027, 10, 7, 5, 30),
      Date.UTC(2027, 10, 8, 6, 30),
    ]);
  });
});

describe("expandir: EXDATE, RDATE, COUNT e UNTIL (T2.5)", () => {
  it("C40: semanal com EXDATE pula só aquela data", () => {
    expect(keys(series({ exdate: ["2026-11-10T08:00"] }))).toEqual([
      "2026-11-03T08:00",
      "2026-11-17T08:00",
      "2026-11-24T08:00",
    ]);
  });

  it("C40: EXDATE com outra hora no mesmo dia não pula nada (a chave é a hora local)", () => {
    expect(keys(series({ exdate: ["2026-11-10T09:00"] }))).toHaveLength(4);
  });

  it("RDATE acrescenta uma data fora da regra; RDATE igual a uma ocorrência não duplica", () => {
    const occurrences = expand(series({ rdate: ["2026-11-12T14:00", "2026-11-17T08:00"] }), NOVEMBER);
    expect(occurrences.map((o) => o.key)).toEqual([
      "2026-11-03T08:00",
      "2026-11-10T08:00",
      "2026-11-12T14:00",
      "2026-11-17T08:00",
      "2026-11-24T08:00",
    ]);
    const extra = occurrences[2];
    expect(extra).toEqual({
      key: "2026-11-12T14:00",
      start: Date.UTC(2026, 10, 12, 17, 0),
      end: Date.UTC(2026, 10, 12, 21, 0),
    });
  });

  it("EXDATE também remove uma RDATE com a mesma chave", () => {
    expect(keys(series({ rdate: ["2026-11-12T14:00"], exdate: ["2026-11-12T14:00"] }))).toHaveLength(4);
  });

  it("RDATE fora da janela não entra", () => {
    expect(keys(series({ rdate: ["2026-12-05T08:00"] }))).toHaveLength(4);
  });

  it("COUNT=3 gera 3; UNTIL inclui o próprio dia", () => {
    expect(keys(series({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=3" }))).toEqual([
      "2026-11-03T08:00",
      "2026-11-10T08:00",
      "2026-11-17T08:00",
    ]);
    expect(keys(series({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117" }))).toEqual([
      "2026-11-03T08:00",
      "2026-11-10T08:00",
      "2026-11-17T08:00",
    ]);
  });

  it("UNTIL com hora local é inclusivo naquela hora e corta a seguinte", () => {
    expect(keys(series({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T080000" }))).toHaveLength(3);
    expect(keys(series({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T075900" }))).toHaveLength(2);
  });

  it("COUNT conta desde o DTSTART, não desde o início da janela", () => {
    const window = { de: Date.UTC(2026, 10, 9), until: Date.UTC(2026, 11, 1) };
    expect(keys(series({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=3" }), window)).toEqual([
      "2026-11-10T08:00",
      "2026-11-17T08:00",
    ]);
  });
});

describe("janela de materialização (L-004)", () => {
  const daily = series({ dtstart: "2026-11-01T08:00", durationMin: 60, rrule: "FREQ=DAILY" });

  it("JANELA_MATERIALIZACAO_DIAS é 90 e a janela vai de agora a agora + 90 dias", () => {
    expect(MATERIALIZATION_WINDOW_DAYS).toBe(90);
    const now = Date.UTC(2026, 10, 1, 12);
    expect(materializationWindow(now)).toEqual({ de: now, until: now + 90 * DAY });
  });

  it("ocorrência que começa exatamente em `de` entra; exatamente em `ate` não entra", () => {
    const now = localToInstant("2026-11-02T08:00", SP);
    const occurrences = expand(daily, materializationWindow(now));
    expect(occurrences[0]?.start).toBe(now);
    expect(occurrences.at(-1)?.start).toBe(now + 89 * DAY);
    expect(occurrences.some((o) => o.start === now + 90 * DAY)).toBe(false);
    expect(occurrences).toHaveLength(90);
  });

  it("ocorrência a 89 dias e 23:59 entra; a 90 dias não entra", () => {
    const target = localToInstant("2027-01-31T08:00", SP);
    const inside = expand(daily, materializationWindow(target - (89 * DAY + 23 * 60 * MIN + 59 * MIN)));
    expect(inside.at(-1)?.key).toBe("2027-01-31T08:00");
    const outside = expand(daily, materializationWindow(target - 90 * DAY));
    expect(outside.at(-1)?.key).toBe("2027-01-30T08:00");
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
  ])("%j lança invalid_rrule", (rrule) => {
    expect(() => expand(series({ rrule }), NOVEMBER)).toThrow(new Error("invalid_rrule"));
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
  ])("PD-26: %j lança invalid_rrule (início, hora e fuso vêm dos campos da série)", (rrule) => {
    expect(() => expand(series({ rrule }), NOVEMBER)).toThrow(new Error("invalid_rrule"));
  });
});

describe("ocorrenciasNovas / dividirSerie / separarMaterializadas", () => {
  const WIDE = { de: Date.UTC(2026, 10, 1, 3), until: Date.UTC(2027, 2, 1, 3) };
  const all = (s: Series) => keys(s, WIDE);

  it("PD-26: ocorrência já materializada, editada ou cancelada não volta", () => {
    const s = series();
    const existing = new Set(["2026-11-10T08:00", "2026-11-17T08:00"]); // uma editada, outra cancelada
    const fresh = newOccurrences(s, existing, NOVEMBER);
    expect(fresh.map((o) => o.key)).toEqual(["2026-11-03T08:00", "2026-11-24T08:00"]);
    expect(fresh[0]?.start).toBe(localToInstant("2026-11-03T08:00", SP));
    const after = new Set([...existing, ...fresh.map((o) => o.key)]);
    expect(newOccurrences(s, after, NOVEMBER)).toEqual([]);
  });

  it("PD-27: dividir na 3ª ocorrência: a antiga termina na 2ª, a nova começa na 3ª, sem buraco nem repetição", () => {
    const s = series();
    const { old, new: fresh } = splitSeries(s, "2026-11-17T08:00");
    expect(old.rrule).toBe("FREQ=WEEKLY;BYDAY=TU;UNTIL=20261116");
    expect(fresh.dtstart).toBe("2026-11-17T08:00");
    expect(old.dtstart).toBe(s.dtstart);
    expect(keys(old, WIDE).at(-1)).toBe("2026-11-10T08:00");
    expect(keys(fresh, WIDE)[0]).toBe("2026-11-17T08:00");
    expect([...all(old), ...all(fresh)]).toEqual(all(s));
  });

  it("PD-27: dividir na 1ª ocorrência deixa a antiga vazia e a nova igual à original", () => {
    const s = series();
    const { old, new: fresh } = splitSeries(s, s.dtstart);
    expect(all(old)).toEqual([]);
    expect(all(fresh)).toEqual(all(s));
  });

  it("PD-27: COUNT é repartido", () => {
    const s = series({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=5" });
    const { old, new: fresh } = splitSeries(s, "2026-11-17T08:00");
    expect(old.rrule).not.toContain("COUNT");
    expect(fresh.rrule).toContain("COUNT=3");
    expect(all(old)).toEqual(["2026-11-03T08:00", "2026-11-10T08:00"]);
    expect(all(fresh)).toEqual(["2026-11-17T08:00", "2026-11-24T08:00", "2026-12-01T08:00"]);
    expect([...all(old), ...all(fresh)]).toEqual(all(s));
  });

  it("PD-27: COUNT conta também as ocorrências removidas por EXDATE antes do corte", () => {
    const s = series({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=5", exdate: ["2026-11-10T08:00"] });
    const { old, new: fresh } = splitSeries(s, "2026-11-17T08:00");
    expect(fresh.rrule).toContain("COUNT=3");
    expect([...all(old), ...all(fresh)]).toEqual(all(s));
  });

  it("PD-27: EXDATE de depois do corte vai para a nova", () => {
    const s = series({ exdate: ["2026-11-10T08:00", "2026-11-24T08:00"] });
    const { old, new: fresh } = splitSeries(s, "2026-11-17T08:00");
    expect(old.exdate).toEqual(["2026-11-10T08:00"]);
    expect(fresh.exdate).toEqual(["2026-11-24T08:00"]);
  });

  it("PD-27: RDATE e EXDATE dos dois lados do corte: a concatenação é a expansão original", () => {
    const base = {
      exdate: ["2026-11-10T08:00", "2026-12-01T08:00"],
      rdate: ["2026-11-12T14:00", "2026-11-17T07:00", "2026-11-19T14:00"],
    };
    for (const rrule of [
      "FREQ=WEEKLY;BYDAY=TU",
      "FREQ=WEEKLY;BYDAY=TU;COUNT=6",
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH",
    ]) {
      const s = series({ ...base, rrule });
      const { old, new: fresh } = splitSeries(s, "2026-11-17T08:00");
      expect(old.rdate).toEqual(["2026-11-12T14:00", "2026-11-17T07:00"]);
      expect(fresh.rdate).toEqual(["2026-11-19T14:00"]);
      const together = [...all(old), ...all(fresh)].sort();
      expect(together).toEqual(all(s));
      expect(new Set(together).size).toBe(together.length);
    }
  });

  describe("corte em RDATE", () => {
    const together = (s: Series, cut: string) => {
      const { old, new: fresh } = splitSeries(s, cut);
      const allTogether = [...all(old), ...all(fresh)].sort();
      expect(allTogether).toEqual(all(s)); // sem buraco nem repetição
      return { old, new: fresh };
    };

    it("PD-27: corte em RDATE de outra hora mantém a hora da regra na nova", () => {
      const s = series({ rdate: ["2026-11-17T07:00"] });
      const { new: fresh } = together(s, "2026-11-17T07:00");
      expect(all(fresh)).toContain("2026-11-24T08:00");
      expect(all(fresh)).not.toContain("2026-11-24T07:00");
    });

    it("PD-27: regra sem BYDAY com RDATE em outro dia da semana não vira 'toda quinta'", () => {
      const s = series({ rrule: "FREQ=WEEKLY", rdate: ["2026-11-12T08:00"] });
      const { new: fresh } = together(s, "2026-11-12T08:00");
      expect(all(fresh)).not.toContain("2026-11-19T08:00");
    });

    it("PD-27: RDATE depois do UNTIL: a antiga não ganha ocorrências", () => {
      const s = series({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261124", rdate: ["2026-12-20T09:00"] });
      const { old, new: fresh } = together(s, "2026-12-20T09:00");
      expect(old.rrule).toBe(s.rrule);
      expect(all(fresh)).toEqual(["2026-12-20T09:00"]);
    });

    it("PD-27: RDATE depois do COUNT: a antiga não ganha ocorrências", () => {
      const s = series({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=3", rdate: ["2026-12-20T09:00"] });
      const { old, new: fresh } = together(s, "2026-12-20T09:00");
      expect(old.rrule).toBe(s.rrule);
      expect(all(fresh)).toEqual(["2026-12-20T09:00"]);
    });

    it("PD-27: INTERVAL=2 com RDATE fora do padrão mantém a fase", () => {
      const s = series({ rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU", rdate: ["2026-11-12T08:00", "2026-11-18T08:00"] });
      together(s, "2026-11-12T08:00");
      together(s, "2026-11-18T08:00");
    });

    it("PD-27: RDATE às 14:00 em dia com ocorrência da regra às 08:00 não perde a das 08:00", () => {
      const s = series({ rdate: ["2026-11-17T14:00"] });
      const { old } = together(s, "2026-11-17T14:00");
      expect(all(old)).toContain("2026-11-17T08:00");
    });

    it("PD-27: COUNT com corte em RDATE é repartido", () => {
      const s = series({ rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=5", rdate: ["2026-11-19T10:00"] });
      together(s, "2026-11-19T10:00");
    });
  });

  it("PD-27: não altera a série recebida e preserva UNTIL original na nova", () => {
    const s = series({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261201", exdate: ["2026-11-24T08:00"] });
    const copy = structuredClone(s);
    const { old, new: fresh } = splitSeries(s, "2026-11-17T08:00");
    expect(s).toEqual(copy);
    expect(old.rrule).toBe("FREQ=WEEKLY;BYDAY=TU;UNTIL=20261116");
    expect(fresh.rrule).toBe("FREQ=WEEKLY;BYDAY=TU;UNTIL=20261201");
    expect([...all(old), ...all(fresh)]).toEqual(all(s));
  });

  it("PD-27: chave que não é ocorrência da série lança occurrence_not_found", () => {
    const s = series({ exdate: ["2026-11-17T08:00"] });
    expect(() => splitSeries(s, "2026-11-18T08:00")).toThrow("occurrence_not_found");
    expect(() => splitSeries(s, "2026-11-17T08:00")).toThrow("occurrence_not_found");
    expect(() => splitSeries(s, "2026-11-10T09:00")).toThrow("occurrence_not_found");
  });

  it("PD-27: sessão com entradas é mantida; planejada vazia é apagada; aberta ou encerrada nunca é apagada", () => {
    const r = separateMaterialized(
      [
        { key: "2026-11-10T08:00", hasEntries: false, state: "planned" }, // passada
        { key: "2026-11-17T08:00", hasEntries: false, state: "planned" }, // a do corte
        { key: "2026-11-24T08:00", hasEntries: true, state: "planned" },
        { key: "2026-12-01T08:00", hasEntries: false, state: "open" },
        { key: "2026-12-08T08:00", hasEntries: false, state: "closed" },
        { key: "2026-12-15T08:00", hasEntries: false, state: "cancelled" },
        { key: "2026-12-22T08:00", hasEntries: false, state: "planned" },
      ],
      "2026-11-17T08:00",
    );
    expect(r.erase).toEqual(["2026-11-17T08:00", "2026-12-22T08:00"]);
    expect(r.keep).toEqual([
      "2026-11-10T08:00",
      "2026-11-24T08:00",
      "2026-12-01T08:00",
      "2026-12-08T08:00",
      "2026-12-15T08:00",
    ]);
  });
});
