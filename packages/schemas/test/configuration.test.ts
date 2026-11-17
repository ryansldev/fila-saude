import { describe, expect, it } from "vitest";
import { municipalityConfigSchema } from "../config.ts";
import { seriesInputSchema } from "../series.ts";
import { serviceInputSchema } from "../service.ts";
import { sessionInputSchema } from "../session.ts";
import { stationInputSchema } from "../station.ts";
import { tvStateSchema } from "../tv.ts";
import { unitInputSchema } from "../unit.ts";
import { staffUserInputSchema } from "../user.ts";

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;
const id = "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f";

const unit = {
  name: "UBS Centro",
  kind: "ubs",
  address: { postalCode: "01001-000", street: "Praça da Sé", number: "100", complement: null, neighborhood: "Sé" },
  cnes: null,
  lat: -23.5,
  lng: -46.6,
  timeZone: "America/Sao_Paulo",
  time: { "1": [{ opens: "08:00", closes: "17:00" }] },
};

describe("unitInputSchema", () => {
  it("aceita unidade válida", () => expect(ok(unitInputSchema, unit)).toBe(true));
  it("endereço: CEP com ou sem máscara vira 8 dígitos; logradouro, número e bairro obrigatórios", () => {
    const r = unitInputSchema.safeParse(unit);
    expect(r.success && r.data.address.postalCode).toBe("01001000");
    expect(ok(unitInputSchema, { ...unit, address: { ...unit.address, postalCode: "0100100" } })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, address: { ...unit.address, neighborhood: "" } })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, address: { ...unit.address, number: "s/n" } })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, address: "Rua A, 1" })).toBe(false);
  });
  it("latitude e longitude são opcionais", () => {
    const { lat: _lat, lng: _lng, ...withoutCoordinates } = unit;
    expect(ok(unitInputSchema, withoutCoordinates)).toBe(true);
    expect(ok(unitInputSchema, { ...withoutCoordinates, lat: null, lng: null })).toBe(true);
  });
  it("horário: vários intervalos no dia; sobrepostos recusados; encostados aceitos; dia vazio é fechado", () => {
    const h = (intervals: { opens: string; closes: string }[]) => ({ ...unit, time: { "1": intervals } });
    expect(
      ok(
        unitInputSchema,
        h([
          { opens: "07:00", closes: "12:00" },
          { opens: "13:00", closes: "17:00" },
        ]),
      ),
    ).toBe(true);
    expect(
      ok(
        unitInputSchema,
        h([
          { opens: "07:00", closes: "12:00" },
          { opens: "11:00", closes: "17:00" },
        ]),
      ),
    ).toBe(false);
    expect(
      ok(
        unitInputSchema,
        h([
          { opens: "13:00", closes: "17:00" },
          { opens: "07:00", closes: "13:00" },
        ]),
      ),
    ).toBe(true);
    expect(ok(unitInputSchema, h([]))).toBe(true);
  });
  it("CNES da unidade: 7 dígitos ou nulo", () => {
    expect(ok(unitInputSchema, { ...unit, cnes: "2077485" })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, cnes: "207748" })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, cnes: null })).toBe(true);
  });
  it("lat 90 / 90.0001", () => {
    expect(ok(unitInputSchema, { ...unit, lat: 90 })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, lat: 90.0001 })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, lat: -90 })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, lat: -90.0001 })).toBe(false);
  });
  it("lng 180 / 180.0001", () => {
    expect(ok(unitInputSchema, { ...unit, lng: 180 })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, lng: 180.0001 })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, lng: -180 })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, lng: -180.0001 })).toBe(false);
  });
  it("fuso IANA válido / inválido", () => {
    expect(ok(unitInputSchema, { ...unit, timeZone: "America/Sao_Paulo" })).toBe(true);
    expect(ok(unitInputSchema, { ...unit, timeZone: "Brasil/Recife" })).toBe(false);
  });
  it("config da unidade com toleranciaMin 0 recusada", () =>
    expect(ok(unitInputSchema, { ...unit, config: { toleranceMin: 0 } })).toBe(false));
  it("tipo inválido recusado", () => expect(ok(unitInputSchema, { ...unit, kind: "hospital" })).toBe(false));
  it("fecha antes de abre recusado; igual também", () => {
    const h = (opens: string, closes: string) => ({ ...unit, time: { "1": [{ opens, closes }] } });
    expect(ok(unitInputSchema, h("08:00", "07:59"))).toBe(false);
    expect(ok(unitInputSchema, h("08:00", "08:00"))).toBe(false);
    expect(ok(unitInputSchema, h("08:00", "08:01"))).toBe(true);
  });
  it("o erro de fecha antes de abre fica no campo closes", () => {
    const r = unitInputSchema.safeParse({ ...unit, time: { "1": [{ opens: "08:00", closes: "07:00" }] } });
    expect(r.error?.issues[0]?.path).toEqual(["time", "1", 0, "closes"]);
  });
  it("hora fora do formato HH:mm recusada", () => {
    expect(ok(unitInputSchema, { ...unit, time: { "1": [{ opens: "8:00", closes: "17:00" }] } })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, time: { "1": [{ opens: "08:00", closes: "24:00" }] } })).toBe(false);
    expect(ok(unitInputSchema, { ...unit, time: { "1": [{ opens: "08:00", closes: "23:59" }] } })).toBe(true);
  });
  it("dia da semana fora de 0..6 recusado", () =>
    expect(ok(unitInputSchema, { ...unit, time: { "7": [{ opens: "08:00", closes: "17:00" }] } })).toBe(false));
  it("configurações opcionais aceitas", () =>
    expect(ok(unitInputSchema, { ...unit, config: { windowK: 2, toleranceMin: null } })).toBe(true));
});

describe("municipalityConfigSchema", () => {
  it("aceita vazio (tudo herda) e valores", () => {
    expect(ok(municipalityConfigSchema, {})).toBe(true);
    expect(
      ok(municipalityConfigSchema, {
        windowK: 2,
        municipalityOrder: "priority",
        noShowAlert: { noShows: 2, days: 90 },
      }),
    ).toBe(true);
  });
  it("windowK 0 / 1", () => {
    expect(ok(municipalityConfigSchema, { windowK: 0 })).toBe(false);
    expect(ok(municipalityConfigSchema, { windowK: 1 })).toBe(true);
  });
  it("toleranciaMin 0/1 e inteiro", () => {
    expect(ok(municipalityConfigSchema, { toleranceMin: 0 })).toBe(false);
    expect(ok(municipalityConfigSchema, { toleranceMin: 1 })).toBe(true);
    expect(ok(municipalityConfigSchema, { toleranceMin: 1.5 })).toBe(false);
  });
  it("saiaDeCasaMin 0/1", () => {
    expect(ok(municipalityConfigSchema, { leaveHomeMin: 0 })).toBe(false);
    expect(ok(municipalityConfigSchema, { leaveHomeMin: 1 })).toBe(true);
  });
  it("qrSegundos 9/10 e 300/301", () => {
    expect(ok(municipalityConfigSchema, { qrSeconds: 9 })).toBe(false);
    expect(ok(municipalityConfigSchema, { qrSeconds: 10 })).toBe(true);
    expect(ok(municipalityConfigSchema, { qrSeconds: 300 })).toBe(true);
    expect(ok(municipalityConfigSchema, { qrSeconds: 301 })).toBe(false);
  });
  it("destaqueTvSegundos 2/3 e 60/61", () => {
    expect(ok(municipalityConfigSchema, { tvHighlightSeconds: 2 })).toBe(false);
    expect(ok(municipalityConfigSchema, { tvHighlightSeconds: 3 })).toBe(true);
    expect(ok(municipalityConfigSchema, { tvHighlightSeconds: 60 })).toBe(true);
    expect(ok(municipalityConfigSchema, { tvHighlightSeconds: 61 })).toBe(false);
  });
  it("prazoConfirmacaoHoras e tempoMedioInicialMin 0/1", () => {
    expect(ok(municipalityConfigSchema, { confirmationDeadlineHours: 0 })).toBe(false);
    expect(ok(municipalityConfigSchema, { confirmationDeadlineHours: 1 })).toBe(true);
    expect(ok(municipalityConfigSchema, { initialAverageTimeMin: 0 })).toBe(false);
    expect(ok(municipalityConfigSchema, { initialAverageTimeMin: 1 })).toBe(true);
  });
  it("alertaFaltas faltas/dias 0/1", () => {
    expect(ok(municipalityConfigSchema, { noShowAlert: { noShows: 0, days: 90 } })).toBe(false);
    expect(ok(municipalityConfigSchema, { noShowAlert: { noShows: 1, days: 0 } })).toBe(false);
    expect(ok(municipalityConfigSchema, { noShowAlert: { noShows: 1, days: 1 } })).toBe(true);
  });
  it("booleanos de vínculo e pré-cadastro, anuláveis", () => {
    expect(
      ok(municipalityConfigSchema, { requiresPreRegistration: false, onlyLinked: true, oneUnitAtATime: null }),
    ).toBe(true);
    expect(ok(municipalityConfigSchema, { onlyLinked: "sim" })).toBe(false);
    expect(ok(municipalityConfigSchema, { oneUnitAtATime: 1 })).toBe(false);
  });
  it("ordem inválida recusada", () => expect(ok(municipalityConfigSchema, { municipalityOrder: "x" })).toBe(false));
});

describe("staffUserInputSchema", () => {
  const u = {
    login: "ana",
    name: "Ana",
    password: "12345678",
    unitLinks: [],
    roles: [{ role: "sms_management", unitId: null }],
  };
  it("aceita válido", () => expect(ok(staffUserInputSchema, u)).toBe(true));
  it("login 2/3", () => {
    expect(ok(staffUserInputSchema, { ...u, login: "ab" })).toBe(false);
    expect(ok(staffUserInputSchema, { ...u, login: "abc" })).toBe(true);
  });
  it("login 30/31", () => {
    expect(ok(staffUserInputSchema, { ...u, login: "a".repeat(30) })).toBe(true);
    expect(ok(staffUserInputSchema, { ...u, login: "a".repeat(31) })).toBe(false);
  });
  it("senha 7/8", () => {
    expect(ok(staffUserInputSchema, { ...u, password: "1234567" })).toBe(false);
    expect(ok(staffUserInputSchema, { ...u, password: "12345678" })).toBe(true);
  });
  it("ocupação com unidadeId uuid; ocupação inválida recusada", () => {
    expect(ok(staffUserInputSchema, { ...u, unitLinks: [{ occupation: "reception", unitId: id }] })).toBe(true);
    expect(ok(staffUserInputSchema, { ...u, unitLinks: [{ occupation: "patient", unitId: id }] })).toBe(false);
    expect(ok(staffUserInputSchema, { ...u, unitLinks: [{ occupation: "reception", unitId: "x" }] })).toBe(false);
  });
});

describe("serviceInputSchema", () => {
  const s = { name: "Clínico", prefix: "C", requiresTriage: true, mode: "direct", averageTimeMin: { care: 15 } };
  it("aceita válido", () => expect(ok(serviceInputSchema, s)).toBe(true));
  it("prefixo 0/1 letras", () => {
    expect(ok(serviceInputSchema, { ...s, prefix: "" })).toBe(false);
    expect(ok(serviceInputSchema, { ...s, prefix: "C" })).toBe(true);
  });
  it("prefixo 3/4 letras", () => {
    expect(ok(serviceInputSchema, { ...s, prefix: "CLI" })).toBe(true);
    expect(ok(serviceInputSchema, { ...s, prefix: "CLIN" })).toBe(false);
  });
  it("prefixo só maiúsculas", () => {
    expect(ok(serviceInputSchema, { ...s, prefix: "c" })).toBe(false);
    expect(ok(serviceInputSchema, { ...s, prefix: "C1" })).toBe(false);
  });
  it("tempoMedioMin 0/1 por etapa", () => {
    expect(ok(serviceInputSchema, { ...s, averageTimeMin: { triage: 0 } })).toBe(false);
    expect(ok(serviceInputSchema, { ...s, averageTimeMin: { triage: 1 } })).toBe(true);
    expect(ok(serviceInputSchema, { ...s, averageTimeMin: { care: 0 } })).toBe(false);
  });
  it("modo inválido recusado", () => expect(ok(serviceInputSchema, { ...s, mode: "x" })).toBe(false));
});

describe("stationInputSchema", () => {
  const e = { name: "Sala 1", stage: "care", services: [id] };
  it("aceita válido", () => expect(ok(stationInputSchema, e)).toBe(true));
  it("servicos 0/1", () => {
    expect(ok(stationInputSchema, { ...e, services: [] })).toBe(false);
    expect(ok(stationInputSchema, e)).toBe(true);
  });
  it("etapa inválida recusada", () => expect(ok(stationInputSchema, { ...e, stage: "x" })).toBe(false));
});

describe("sessionInputSchema", () => {
  const s = {
    serviceId: id,
    start: "2026-03-02T08:00:00.000Z",
    end: "2026-03-02T12:00:00.000Z",
    slots: 10,
    visibility: "public",
    waivesPreRegistration: false,
    professional: null,
    stations: [],
  };
  it("aceita válida", () => expect(ok(sessionInputSchema, s)).toBe(true));
  it("PD-37: vagas 0 recusado, 1 aceito, nulo aceito", () => {
    expect(ok(sessionInputSchema, { ...s, slots: -1 })).toBe(false);
    expect(ok(sessionInputSchema, { ...s, slots: 0 })).toBe(false);
    expect(ok(sessionInputSchema, { ...s, slots: 1 })).toBe(true);
    expect(ok(sessionInputSchema, { ...s, slots: null })).toBe(true);
  });
  it("o erro de fim antes do início fica no campo end", () => {
    const r = sessionInputSchema.safeParse({ ...s, end: s.start });
    expect(r.error?.issues[0]?.path).toEqual(["end"]);
  });
  it("fim antes ou igual ao início recusado", () => {
    expect(ok(sessionInputSchema, { ...s, end: s.start })).toBe(false);
    expect(ok(sessionInputSchema, { ...s, end: "2026-03-02T07:00:00.000Z" })).toBe(false);
  });
});

describe("seriesInputSchema", () => {
  const s = {
    serviceId: id,
    dtstart: "2026-03-03T08:00",
    durationMin: 240,
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    exdate: ["2026-03-10T08:00"],
    rdate: ["2026-03-12T08:00"],
    slots: 10,
    visibility: "public",
    waivesPreRegistration: false,
    professional: null,
    stations: [],
  };
  it("aceita válida", () => expect(ok(seriesInputSchema, s)).toBe(true));
  it("duracaoMin 0/1", () => {
    expect(ok(seriesInputSchema, { ...s, durationMin: 0 })).toBe(false);
    expect(ok(seriesInputSchema, { ...s, durationMin: 1 })).toBe(true);
  });
  it("dtstart com fuso/segundos recusado", () => {
    expect(ok(seriesInputSchema, { ...s, dtstart: "2026-03-03T08:00:00Z" })).toBe(false);
    expect(ok(seriesInputSchema, { ...s, dtstart: "2026-03-03" })).toBe(false);
  });
  it("exdate/rdate são locais; omitidos viram vazio", () => {
    expect(ok(seriesInputSchema, { ...s, exdate: ["x"] })).toBe(false);
    const { exdate: _e, rdate: _r, ...without } = s;
    expect(seriesInputSchema.parse(without)).toMatchObject({ exdate: [], rdate: [] });
  });
  it("rrule vazia recusada", () => expect(ok(seriesInputSchema, { ...s, rrule: "" })).toBe(false));
});

describe("tvStateSchema", () => {
  const exp = "2026-03-02T08:10:00.000Z";
  it("aguardando", () => expect(ok(tvStateSchema, { state: "waiting", code: "123456", expiresAt: exp })).toBe(true));
  it("pareada", () =>
    expect(
      ok(tvStateSchema, {
        state: "paired",
        unit: { id, name: "UBS" },
        highlightSeconds: 10,
        calls: [{ id: "x", ticket: "C-001", destination: "Sala 1", at: exp }],
        services: [{ name: "Clínico", waiting: 2, onTheWay: 1 }],
        qr: null,
        careStarted: true,
      }),
    ).toBe(true));
  it("pareada sem unidade e estado desconhecido recusados", () => {
    expect(ok(tvStateSchema, { state: "paired" })).toBe(false);
    expect(ok(tvStateSchema, { state: "x" })).toBe(false);
  });
  it("código de 6 dígitos", () => {
    const v = (code: string) => ({ state: "waiting", code, expiresAt: exp });
    expect(ok(tvStateSchema, v("12345"))).toBe(false);
    expect(ok(tvStateSchema, v("1234567"))).toBe(false);
    expect(ok(tvStateSchema, v("12345a"))).toBe(false);
  });
});
