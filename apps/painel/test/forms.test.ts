import { assignmentUnitKey } from "@fila-saude/domain";
import { serviceInputSchema } from "@fila-saude/schemas/service";
import { assignmentsSchema, staffUserInputSchema } from "@fila-saude/schemas/user";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { errorMessage, sendingErrors, validateClient } from "@/lib/forms/errors";
import { averageTimeText, MINUTES_FIELD, serviceForSending, showsTriageTime } from "@/lib/forms/service";
import {
  adjustVisibility,
  allowedVisibilities,
  readSlots,
  serviceStations,
  sessionsOfDayPath,
  timeForScreen,
  timeForSending,
  validDay,
} from "@/lib/forms/session";
import { servicesForStage } from "@/lib/forms/station";
import { configForSending, inheritedField } from "@/lib/forms/unit";
import { assignableUnits, grantableRoles, registrationProblems } from "@/lib/forms/user";
import { panelMenu } from "@/lib/navigation";

describe("erros da API nos formulários", () => {
  it("erro 400 da API aparece no campo certo", () => {
    const e = new ApiError(400, "invalid_input", undefined, { name: ["obrigatório"], "config.windowK": ["K ≥ 1"] });
    expect(sendingErrors(e)).toMatchObject({
      general: null,
      fields: { name: "obrigatório", "config.windowK": "K ≥ 1" },
    });
  });
  it("409 ultimo_gestor e login_em_uso mostram a mensagem", () => {
    expect(errorMessage(new ApiError(409, "last_manager"))).toMatch(/último gestor/i);
    expect(errorMessage(new ApiError(409, "login_in_use"))).toMatch(/login já está em uso/i);
  });
  it("409 servico_com_entradas mostra quantas entradas", () => {
    const e = new ApiError(409, "service_has_entries", undefined, undefined, { activeEntries: 3 });
    expect(errorMessage(e)).toMatch(/3 entradas ativas/);
  });
  it("409 sessao_aberta, estacao_ocupada, versao_desatualizada e sessao_com_pacientes", () => {
    expect(errorMessage(new ApiError(409, "session_open"))).toMatch(/há sessão aberta/i);
    expect(errorMessage(new ApiError(409, "station_busy"))).toMatch(/estação está aberta/i);
    expect(errorMessage(new ApiError(409, "outdated_version"))).toMatch(/recarregue/i);
    expect(errorMessage(new ApiError(409, "session_has_patients"))).toMatch(/pacientes/i);
  });
  it("a mensagem específica da API vence o texto genérico do painel para o mesmo código", () => {
    const e = new ApiError(409, "forbidden_transition", "Essa pessoa já não está disponível para esta sessão.");
    expect(errorMessage(e)).toBe("Essa pessoa já não está disponível para esta sessão.");
    expect(errorMessage(new ApiError(409, "forbidden_transition"))).toMatch(/estado atual/);
  });
  it("erro desconhecido vira mensagem genérica", () => {
    expect(errorMessage(new Error("x"))).toMatch(/tente de novo/i);
  });
});

describe("unidade", () => {
  const effective = {
    values: { windowK: 3, toleranceMin: 7 },
    origin: { windowK: "default", toleranceMin: "unit" },
  } as const;
  it("campo vazio mostra o valor herdado e a origem", () => {
    expect(inheritedField(effective, "windowK")).toEqual({
      value: 3,
      origin: "default",
      own: false,
      text: "herdado do padrão: 3",
    });
    expect(inheritedField(effective, "toleranceMin").own).toBe(true);
  });
  it("campo sem origem conta como do padrão", () => {
    expect(inheritedField({ values: { windowK: 3 }, origin: {} }, "windowK")).toMatchObject({
      origin: "default",
      text: "herdado do padrão: 3",
    });
  });
  it("limpar um valor próprio envia null e volta a herdar", () => {
    expect(configForSending({ windowK: "", toleranceMin: "" }, ["toleranceMin"])).toEqual({ toleranceMin: null });
    expect(configForSending({ windowK: "4" }, [])).toEqual({ windowK: 4 });
  });
});

describe("equipe", () => {
  const sms = { unitLinks: [], roles: [{ role: "sms_management" as const, unitId: null }] };
  const manager = { unitLinks: [], roles: [{ role: "unit_manager" as const, unitId: "u1" }] };
  const units = [
    { id: "u1", name: "UBS 1" },
    { id: "u2", name: "UBS 2" },
  ];

  it("RN-PERF-04: o formulário só oferece o que quem está logado pode conceder", () => {
    expect(grantableRoles(sms)).toEqual(["sms_management", "sms_regulation", "unit_manager", "scheduler"]);
    expect(grantableRoles(manager)).toEqual(["scheduler"]);
    expect(assignableUnits(sms, units).map((u) => u.id)).toEqual(["u1", "u2"]);
    expect(assignableUnits(manager, units).map((u) => u.id)).toEqual(["u1"]);
  });

  it("ocupação exige a unidade; função de gerente exige a unidade; nada marcado pede ao menos uma", () => {
    expect(registrationProblems(sms, { unitLinks: [], roles: [] })).toEqual({
      _: "Informe ao menos uma ocupação ou função.",
    });
    expect(registrationProblems(sms, { unitLinks: [], roles: [{ role: "unit_manager", unitId: null }] })).toEqual({
      "roles.0.unitId": "Escolha a unidade.",
    });
    expect(registrationProblems(sms, { unitLinks: [{ unitId: "u1", occupation: "nurse" }], roles: [] })).toEqual({});
  });

  it("gerente que tenta cadastrar em outra UBS recebe o aviso antes de enviar", () => {
    expect(
      registrationProblems(manager, { unitLinks: [{ unitId: "u2", occupation: "physician" }], roles: [] }),
    ).toEqual({
      _: "Você só cadastra a equipe da sua unidade, sem função de gestão.",
    });
  });
});

describe("serviço e estação", () => {
  it("tempo de triagem some sem triagem", () => {
    expect(showsTriageTime(false)).toBe(false);
    expect(
      serviceForSending({
        name: "X",
        prefix: "x",
        requiresTriage: false,
        mode: "direct",
        triage: "5",
        care: "15",
      }),
    ).toEqual({ name: "X", prefix: "X", requiresTriage: false, mode: "direct", averageTimeMin: { care: 15 } });
  });
  it("etapa triagem filtra os serviços", () => {
    const services = [
      { id: "a", name: "A", requiresTriage: true },
      { id: "b", name: "B", requiresTriage: false },
    ];
    expect(servicesForStage(services, "triage").map((s) => s.id)).toEqual(["a"]);
    expect(servicesForStage(services, "care")).toHaveLength(2);
  });
});

describe("sessão", () => {
  it("08:00 de 12/11/2026 em America/Sao_Paulo vai como 2026-11-12T11:00:00Z e volta como 08:00", () => {
    const iso = timeForSending("2026-11-12", "08:00", "America/Sao_Paulo");
    expect(iso).toBe("2026-11-12T11:00:00.000Z");
    expect(timeForScreen(iso, "America/Sao_Paulo")).toEqual({ data: "2026-11-12", hour: "08:00" });
  });
  it("privada esconde e desliga a dispensa", () => {
    expect(adjustVisibility({ visibility: "public", waivesPreRegistration: true }, "private")).toEqual({
      visibility: "private",
      waivesPreRegistration: false,
    });
  });
  it("serviço regulado não oferece pública", () => {
    expect(allowedVisibilities("regulated")).toEqual(["private"]);
    expect(allowedVisibilities("direct")).toEqual(["public", "private"]);
  });
  it("só estações que atendem o serviço", () => {
    const stations = [
      { id: "e1", name: "C1", services: ["s1"] },
      { id: "e2", name: "C2", services: ["s2"] },
    ];
    expect(serviceStations(stations, "s1").map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("menu", () => {
  it("menu sem Regras do município; TVs entram na fatia 2", () => {
    const labels = panelMenu([
      { profile: "sms_management", unitId: null },
      { profile: "unit_manager", unitId: "u1" },
    ]).map((i) => i.label);
    expect(labels).not.toContain("Regras do município");
    expect(labels).toEqual([
      "Unidades",
      "Equipe",
      "Serviços",
      "Estações",
      "Sessões",
      "TVs",
      "Fila do dia",
      "QR de entrada",
    ]);
  });
});

describe("erros que sumiam (revisão 2026-11-13)", () => {
  it("chave mais funda chega ao campo que a tela mostra; erro na raiz vira mensagem geral", () => {
    const e = new ApiError(400, "invalid_input", undefined, {
      "horario.1.0.abre": ["hora inválida"],
      _: ["intervalos sobrepostos"],
    });
    const r = sendingErrors(e);
    expect(r.fields["horario.1.0"]).toBe("hora inválida");
    expect(r.general).toBe("intervalos sobrepostos");
  });

  it("códigos de conflito com mensagem própria", () => {
    expect(errorMessage(new ApiError(409, "station_has_call"))).toMatch(/paciente chamado/);
    expect(errorMessage(new ApiError(400, "reason_required"))).toMatch(/motivo/);
    expect(errorMessage(new ApiError(409, "station_in_use"))).toMatch(/sessão/);
    expect(errorMessage(new ApiError(409, "session_closed"))).toMatch(/sessão/);
  });
});

describe("sessões: vagas e dia (revisão 2026-11-13)", () => {
  it("vagas: vazio = sem limite; número inteiro ≥ 1; qualquer outra coisa é erro (antes virava 'sem limite')", () => {
    expect(readSlots("")).toEqual({ ok: true, slots: null });
    expect(readSlots(" 12 ")).toEqual({ ok: true, slots: 12 });
    expect(readSlots("1,5").ok).toBe(false);
    expect(readSlots("dez").ok).toBe(false);
    expect(readSlots("0").ok).toBe(false);
  });

  it("dia com ano de 5 dígitos não derruba a página", () => {
    expect(validDay("2026-11-13")).toBe(true);
    expect(validDay("20261-11-13")).toBe(false);
    expect(validDay("")).toBe(false);
  });
});

describe("validação no painel antes de enviar (revisão 2026-11-13)", () => {
  it("usa o mesmo schema da API e devolve o erro por campo, em português", () => {
    const r = validateClient(staffUserInputSchema, {
      login: "maria silva",
      name: "",
      password: "curta",
      unitLinks: [],
      roles: [],
    });
    expect(r?.fields.login).toMatch(/letras sem acento/);
    expect(r?.fields.password).toBeDefined();
    expect(r?.fields.name).toBeDefined();
    expect(
      validateClient(staffUserInputSchema, {
        login: "maria",
        name: "Maria",
        password: "segredo12",
        unitLinks: [],
        roles: [],
      }),
    ).toBeNull();
  });
});

describe("sessões do dia", () => {
  it("pede à API o intervalo do dia no fuso da unidade, com from e until", () => {
    expect(sessionsOfDayPath("u1", "2026-11-17", "America/Sao_Paulo")).toBe(
      "/v1/panel/units/u1/sessions?from=2026-11-17T03%3A00%3A00.000Z&until=2026-11-18T03%3A00%3A00.000Z",
    );
  });
});

describe("tempo médio do serviço", () => {
  it("o erro dos minutos chega no campo que a tela mostra", () => {
    const e = validateClient(serviceInputSchema, { averageTimeMin: { triage: 0, care: 0 } });
    expect(Object.keys(e?.fields ?? {})).toEqual(expect.arrayContaining([MINUTES_FIELD.triage, MINUTES_FIELD.care]));
  });
});

describe("unidade de um vínculo ou função", () => {
  it("o erro chega na linha certa do editor", () => {
    const e = validateClient(assignmentsSchema, {
      unitLinks: [{ unitId: "", occupation: "nurse" }],
      roles: [{ role: "scheduler", unitId: "x" }],
    });
    expect(Object.keys(e?.fields ?? {})).toEqual(
      expect.arrayContaining([assignmentUnitKey("unitLinks", 0), assignmentUnitKey("roles", 0)]),
    );
  });
});

describe("tempo médio na tabela de serviços", () => {
  it("mostra só o que foi informado; nada informado é 'padrão da unidade'", () => {
    expect(averageTimeText({ triage: 5, care: 15 })).toBe("5 min + 15 min");
    expect(averageTimeText({ care: 15 })).toBe("15 min");
    expect(averageTimeText({ triage: 5 })).toBe("5 min na triagem");
    expect(averageTimeText({})).toBe("padrão da unidade");
  });
});
