import { describe, expect, it } from "vitest";
import {
  documentText,
  emptyQueue,
  groupQueue,
  guardianText,
  minutesSince,
  queueActions,
  rowContext,
  searchQueue,
  sessionPill,
  stationsItOperates,
  stopwatch,
  validFilter,
} from "@/lib/queue";

describe("fila do dia no painel (T3.4, T3.7)", () => {
  it("botões pela matriz e pela unidade do perfil (PD-38)", () => {
    const manager = [{ profile: "unit_manager" as const, unitId: "u1" }];
    const reception = [{ profile: "reception" as const, unitId: "u1" }];
    expect(queueActions(manager, "u1", "planned")).toEqual({ open: true, close: false, attendance: false });
    expect(queueActions(manager, "u1", "open")).toEqual({ open: false, close: true, attendance: false });
    expect(queueActions(manager, "u2", "planned").open).toBe(false);
    expect(queueActions(reception, "u1", "open")).toEqual({ open: false, close: false, attendance: true });
    expect(queueActions(reception, "u1", "planned").attendance).toBe(false);
  });

  it("o cronômetro da chamada (AD-006)", () => {
    const at = "2026-11-12T12:00:00.000Z";
    expect(stopwatch(at, Date.parse(at) + 65_000)).toBe("01:05");
    expect(stopwatch(at, Date.parse(at) - 1000)).toBe("00:00");
  });
});

describe("presença pela recepção (RN-PRES-03, RN-FILA-05), revisão 2026-11-13", () => {
  it("CPF mascarado e nascimento em dd/mm/aaaa para comparar com o documento", () => {
    // Duas informações, duas partes na linha (nada de "Info · Info").
    expect(documentText({ birthDate: "1990-05-05", cpf: "•••.982.247-••" })).toEqual([
      "nasc. 05/05/1990",
      "CPF •••.982.247-••",
    ]);
    expect(documentText({ birthDate: "1990-05-05", cpf: null })).toEqual(["nasc. 05/05/1990", "sem CPF"]);
  });
});

describe("estação: só as que o perfil opera (PD-46), revisão 2026-11-13", () => {
  const ests = [
    { id: "t1", name: "Triagem", stage: "triage" as const },
    { id: "a1", name: "Sala 1", stage: "care" as const },
  ];
  it("técnico só triagem; enfermeiro as duas; perfil de outra unidade, nenhuma", () => {
    expect(stationsItOperates(ests, [{ profile: "nursing_technician", unitId: "u1" }], "u1").map((e) => e.id)).toEqual([
      "t1",
    ]);
    expect(stationsItOperates(ests, [{ profile: "nurse", unitId: "u1" }], "u1").map((e) => e.id)).toEqual(["t1", "a1"]);
    expect(stationsItOperates(ests, [{ profile: "nurse", unitId: "u2" }], "u1")).toEqual([]);
    // Médico, dentista, eMulti: perfil "care", ressalva "atendimento" da matriz.
    expect(stationsItOperates(ests, [{ profile: "care", unitId: "u1" }], "u1").map((e) => e.id)).toEqual(["a1"]);
  });
});

describe("fila do dia por situação (redesenho 2026-11-13)", () => {
  const it_ = (ticket: string, state: string, pendingChecks: string[] = []) => ({ ticket, state, pendingChecks });
  const items = [
    it_("C-005", "remote"),
    it_("C-002", "present"),
    it_("C-004", "remote", ["account"]),
    it_("C-001", "called"),
    it_("C-003", "done_in_stage"),
    it_("C-006", "left_queue"),
    it_("C-007", "present"),
  ];

  it("separa quem precisa da recepção, os chamados, quem está na unidade, a caminho e quem já saiu", () => {
    const g = groupQueue(items);
    expect(g.reception.map((i) => i.ticket)).toEqual(["C-004"]);
    expect(g.called.map((i) => i.ticket)).toEqual(["C-001"]);
    expect(g.inUnit.map((i) => i.ticket)).toEqual(["C-002", "C-007"]);
    expect(g.onTheWay.map((i) => i.ticket)).toEqual(["C-005"]);
    expect(g.closed.map((i) => i.ticket)).toEqual(["C-003", "C-006"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Fila do dia, caminho C: a unidade inteira, com busca.

const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const person = (name: string, ticket: string, cpf: string | null, service = "Clínico geral") => ({
  name,
  ticket,
  service,
  document: { birthDate: "1990-01-01", cpf },
});

describe("busca da Fila do dia", () => {
  const items = [
    person("Ana Souza", "C-001", "•••.982.247-••"),
    person("Carla Dias", "C-002", null),
    person("Ana Souza", "V-002", "•••.982.247-••", "Curativos"),
    person("Bruno Lima", "C-003", "•••.444.777-••"),
  ];

  it("vazia devolve todos", () => {
    expect(searchQueue(items, "  ")).toHaveLength(4);
  });

  it("nome sem acento e sem maiúscula; o mesmo nome em dois serviços aparece duas vezes", () => {
    expect(searchQueue(items, "âna sou").map((i) => i.service)).toEqual(["Clínico geral", "Curativos"]);
  });

  it("senha com ou sem hífen, maiúscula ou minúscula", () => {
    expect(searchQueue(items, "c002").map((i) => i.name)).toEqual(["Carla Dias"]);
    expect(searchQueue(items, "C-002").map((i) => i.name)).toEqual(["Carla Dias"]);
  });

  it("CPF inteiro do documento casa pelos 6 dígitos do meio do CPF mascarado", () => {
    expect(searchQueue(items, "111.444.777-35").map((i) => i.name)).toEqual(["Bruno Lima"]);
    expect(searchQueue(items, "52998224725")).toHaveLength(2);
  });
});

describe("linha da Fila do dia", () => {
  const base = {
    state: "remote",
    stage: "triage",
    pendingChecks: [] as string[],
    since: null as string | null,
    station: null as string | null,
  };
  const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

  it("minutos desde, para baixo e nunca negativo", () => {
    expect(minutesSince(ago(12.7), NOW)).toBe(12);
    expect(minutesSince(new Date(NOW + 60_000).toISOString(), NOW)).toBe(0);
  });

  it("chamado: a sala e há quanto tempo; na unidade: a etapa e há quanto tempo", () => {
    expect(rowContext({ ...base, state: "called", station: "Triagem 1", since: ago(2) }, NOW)).toEqual({
      text: "chamado para Triagem 1",
      time: "há 2 min",
      tone: "called",
    });
    expect(rowContext({ ...base, state: "present", since: ago(12) }, NOW)).toEqual({
      text: "esperando a triagem",
      time: "há 12 min",
      tone: "neutral",
    });
    expect(rowContext({ ...base, state: "present", stage: "care", since: ago(1) }, NOW).text).toBe(
      "esperando o atendimento",
    );
  });

  it("em casa; com pendência, o que a recepção confere; dia antigo sem hora não mostra tempo", () => {
    expect(rowContext(base, NOW)).toEqual({ text: "em casa", time: null, tone: "neutral" });
    expect(rowContext({ ...base, pendingChecks: ["account"] }, NOW)).toEqual({
      text: "conferir a conta",
      time: null,
      tone: "alert",
    });
    expect(rowContext({ ...base, state: "present", since: null }, NOW).time).toBeNull();
  });
});

describe("pílulas de serviço da Fila do dia", () => {
  const session = (state: string, inQueue: number) => ({
    id: "s1",
    service: "Clínico geral",
    state,
    start: "2026-11-16T16:00:00.000Z",
    counts: { inQueue },
  });

  it("aberta mostra quantos estão na fila; planejada, quando abre; encerrada e cancelada", () => {
    expect(sessionPill(session("open", 4), "America/Sao_Paulo")).toEqual({
      label: "Clínico geral",
      detail: "4",
      disabled: false,
    });
    expect(sessionPill(session("planned", 0), "America/Sao_Paulo").detail).toBe("abre às 13:00");
    expect(sessionPill(session("closed", 0), "America/Sao_Paulo").detail).toBe("encerrada");
    expect(sessionPill(session("cancelled", 0), "America/Sao_Paulo").disabled).toBe(true);
  });

  it("filtro guardado que não existe mais volta para 'todas'", () => {
    expect(validFilter("x", [{ id: "a" }])).toBe("todas");
    expect(validFilter(null, [{ id: "a" }])).toBe("todas");
    expect(validFilter("a", [{ id: "a" }])).toBe("a");
  });
});

describe("Fila do dia: tempo curto e fila vazia", () => {
  it("menos de 1 minuto é 'agora', não 'há 0 min'", () => {
    const i = { state: "present", stage: "triage", pendingChecks: [], station: null };
    expect(rowContext({ ...i, since: new Date(NOW - 20_000).toISOString() }, NOW).time).toBe("agora");
  });

  it("antes de abrir, diz quando abre e quantos já se inscreveram; para o gerente, como abrir", () => {
    const s = (state: string, taken: number, start = "2026-11-16T12:00:00.000Z") => ({ state, taken, start });
    expect(emptyQueue([s("planned", 2), s("planned", 3, "2026-11-16T13:00:00.000Z")], "America/Sao_Paulo", false)).toBe(
      "A fila abre às 09:00. Inscritos até agora: 5.",
    );
    expect(emptyQueue([s("planned", 2)], "America/Sao_Paulo", true)).toBe(
      "A fila abre às 09:00. Inscritos até agora: 2. Escolha o serviço acima para abrir a sessão.",
    );
    expect(emptyQueue([s("open", 0)], "America/Sao_Paulo", true)).toBe(
      "Ninguém na fila ainda. Quem se inscrever pelo app aparece aqui.",
    );
    // Sessão que não recebe mais ninguém não convida a se inscrever.
    expect(emptyQueue([s("closed", 0)], "America/Sao_Paulo", true)).toBe("Sessão encerrada. Ninguém ficou na fila.");
    expect(emptyQueue([s("cancelled", 0)], "America/Sao_Paulo", true)).toBe("Sessão cancelada.");
  });
});

describe("quem inscreveu outra pessoa (2026-11-16)", () => {
  it("o primeiro nome e a relação, sem gênero", () => {
    expect(guardianText({ name: "Bruno", relationship: "legal_guardian" })).toEqual({
      text: "por Bruno (responsável legal)",
      label: "inscrição feita por Bruno, responsável legal",
    });
    expect(guardianText({ name: "Bruno", relationship: "caregiver" })?.text).toBe("por Bruno (cuida no dia a dia)");
    expect(guardianText({ name: "Bruno", relationship: "family_or_friend" })?.text).toBe(
      "por Bruno (família ou amigo)",
    );
  });

  it("inscrita por outra conta antes de existir a relação: só quem inscreveu", () => {
    expect(guardianText({ name: "Bruno", relationship: null })).toEqual({
      text: "por Bruno",
      label: "inscrição feita por Bruno",
    });
  });

  it("inscrita pela própria pessoa: nada", () => {
    expect(guardianText(null)).toBeNull();
  });
});
