import type { MyEntry } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  canCheckIn,
  cancellationNotice,
  cancellationText,
  entrySituation,
  entrySummary,
  errorMessage,
  errorNotice,
  nextStep,
  refusalNotice,
  type Situation,
  WORSENED_GUIDANCE,
} from "@/lib/texts";

const sit = (e: MyEntry) => entrySituation(e, 0);

const base: MyEntry = {
  entryId: "00000000-0000-4000-8000-000000000001",
  person: "Ana",
  state: "in_queue",
  service: "Clínico",
  unit: "UBS Centro",
  session: null,
  ticket: "C-001",
  itemState: "remote",
  estimate: null,
  call: null,
  pendingChecks: [],
  leaveHome: false,
  confirmationDeadline: null,
  serviceId: "00000000-0000-4000-8000-0000000000aa",
  forMe: true,
  birthDate: "1990-05-05",
  refusalEnds: false,
  timeZone: "America/Sao_Paulo",
  canCancel: true,
  stage: "care",
  triaged: false,
  referred: false,
};

describe("minha fila: estado de cada entrada, como no design do app", () => {
  it("posição em casa e na unidade; venha agora; sua vez com a sala", () => {
    expect(sit({ ...base, estimate: { kind: "position", position: 4, minutes: 12 } })).toEqual({
      kind: "position",
      position: 4,
      minutes: 12,
      present: false,
      leave: false,
    });
    // Já recebeu o push "hora de sair de casa": a tela diz o mesmo.
    expect(sit({ ...base, leaveHome: true, estimate: { kind: "position", position: 4, minutes: 12 } })).toMatchObject({
      leave: true,
    });
    expect(
      sit({ ...base, itemState: "present", estimate: { kind: "position", position: 2, minutes: 5 } }),
    ).toMatchObject({ kind: "position", present: true });
    expect(sit({ ...base, estimate: { kind: "come_now" } })).toEqual({ kind: "come" });
    expect(
      sit({
        ...base,
        itemState: "called",
        estimate: { kind: "called" },
        call: { station: "Sala 1", at: "2026-11-12T12:00:00.000Z" },
      }),
    ).toEqual({ kind: "turn", ticket: "C-001", station: "Sala 1" });
  });

  it("RN-FILA-05: QR recusado → passe na recepção, antes da posição", () => {
    expect(
      sit({ ...base, pendingChecks: ["account"], estimate: { kind: "position", position: 3, minutes: 9 } }),
    ).toEqual({
      kind: "reception",
    });
  });

  it("antes de abrir, reserva e lista; depois, atendido, remanejado e saiu", () => {
    const without = { ...base, ticket: null, itemState: null };
    expect(sit({ ...without, state: "confirmed" }).kind).toBe("confirmed");
    expect(sit({ ...without, state: "in_reserve" }).kind).toBe("reserve");
    expect(sit({ ...without, state: "waiting" }).kind).toBe("list");
    const planned = {
      id: base.entryId,
      start: "2026-11-13T10:00:00.000Z",
      end: "2026-11-13T20:00:00.000Z",
      breaks: [],
      state: "planned",
    };
    expect(sit({ ...base, session: planned, estimate: { kind: "awaiting_start" } }).kind).toBe("waiting");
    expect(sit({ ...base, state: "completed", itemState: "done_in_stage" }).kind).toBe("completed");
    expect(sit({ ...base, state: "reassigned", itemState: "reassigned" }).kind).toBe("reassigned");
    expect(sit({ ...base, state: "closed_without_care", itemState: "left_queue" }).kind).toBe("left");
  });

  it("mensagens de erro em minúsculas, como o resto do app", () => {
    expect(errorMessage(new ApiError(409, "duplicate"))).toBe("essa pessoa já está inscrita neste atendimento.");
    expect(errorMessage(new ApiError(0, "no_connection"))).toMatch(/^sem internet/);
    expect(errorMessage(new Error("x"))).toBe("não deu certo. tente de novo.");
    // RN-ID-04: o bloqueio do login dura 15 min; o limite de CPFs diz o que fazer (vem do servidor).
    expect(errorMessage(new ApiError(429, "login_locked", "Muitas tentativas. Espere 30 minutos."))).toBe(
      "muitas tentativas. espere 30 minutos.",
    );
    expect(errorMessage(new ApiError(429, "cpf_lookup_limit", "Muitas pessoas informadas em pouco tempo."))).toBe(
      "muitas pessoas informadas em pouco tempo.",
    );
  });
});

describe("aviso de erro na minha fila", () => {
  it("'sem internet' só quando a rede falha; outro erro diz o que houve", () => {
    expect(errorNotice(new ApiError(0, "no_connection"))).toEqual({
      title: "sem internet",
      text: "a sua posição volta a aparecer quando a conexão voltar.",
    });
    expect(errorNotice(new ApiError(401, "not_authenticated"))).toEqual({
      title: "não deu para atualizar",
      text: "sua sessão expirou. entre de novo.",
    });
    // Agenda e municípios não têm posição: o texto do "sem internet" é da tela.
    expect(errorNotice(new ApiError(0, "no_connection"), "confira a conexão e tente de novo.").text).toBe(
      "confira a conexão e tente de novo.",
    );
  });
});

describe("estados que não podem mentir para o paciente (revisão 2026-11-13)", () => {
  const NOW = Date.parse("2026-11-13T12:00:00.000Z"); // 9h em Brasília
  const session = (start: string, state = "planned") => ({
    id: "00000000-0000-4000-8000-000000000009",
    start,
    end: "2026-11-13T20:00:00.000Z",
    breaks: [],
    state,
  });
  const confirmed = { ...base, state: "confirmed", ticket: null, itemState: null };

  it("confirmada antes do início: a fila começa às 7h; depois do início, sem abrir: a unidade ainda não abriu", () => {
    expect(entrySituation({ ...confirmed, session: session("2026-11-13T13:00:00.000Z") }, NOW).kind).toBe("confirmed");
    expect(entrySituation({ ...confirmed, session: session("2026-11-13T10:00:00.000Z") }, NOW).kind).toBe("late");
  });

  it("RN-SES-05: em modo manual, o próximo passo é procurar a recepção (os avisos estão parados)", () => {
    const open = { ...base, session: session("2026-11-13T10:00:00.000Z", "open") };
    for (const present of [false, true]) {
      const sit = { kind: "no_estimate" as const, present, manual: true as const };
      expect(nextStep({ ...open, itemState: present ? "present" : "remote" }, sit, NOW)).toBe(
        "atendimento em modo manual. procure a recepção.",
      );
    }
  });

  it("o botão 'cheguei na unidade' em casa e na fila, também em modo manual (a unidade sem TV ainda tem QR)", () => {
    expect(canCheckIn({ kind: "come" }, "remote")).toBe(true);
    expect(canCheckIn({ kind: "no_estimate", present: false }, "remote")).toBe(true);
    expect(canCheckIn({ kind: "no_estimate", present: false, manual: true }, "remote")).toBe(true);
    expect(canCheckIn({ kind: "come" }, "present")).toBe(false);
    expect(canCheckIn({ kind: "reception" }, "remote")).toBe(false);
  });

  it("cancelada (pelo paciente, agendador ou recepção) nunca vira 'você foi chamado e não apareceu'", () => {
    expect(entrySituation({ ...base, state: "cancelled", itemState: "left_queue" }, NOW).kind).toBe("cancelled");
    expect(entrySituation({ ...base, state: "archived", itemState: null }, NOW).kind).toBe("cancelled");
  });

  it("fila aberta sem previsão não diz 'aguardando início'; modo manual tem tela própria", () => {
    const open = { ...base, session: session("2026-11-13T10:00:00.000Z", "open") };
    expect(entrySituation({ ...open, itemState: "present", estimate: { kind: "awaiting_start" } }, NOW)).toEqual({
      kind: "no_estimate",
      present: true,
    });
    // RN-SES-05: a unidade sem sinal (modo manual) manda procurar a recepção.
    expect(entrySituation({ ...open, estimate: { kind: "manual_mode" } }, NOW)).toEqual({
      kind: "no_estimate",
      present: false,
      manual: true,
    });
    expect(
      entrySituation(
        { ...base, session: session("2026-11-13T13:00:00.000Z"), estimate: { kind: "awaiting_start" } },
        NOW,
      ).kind,
    ).toBe("waiting");
  });

  it("alocada mostra a data marcada; chamado sem sala ainda é a vez", () => {
    expect(
      entrySituation(
        { ...base, state: "allocated", ticket: null, itemState: null, session: session("2026-11-20T13:00:00.000Z") },
        NOW,
      ).kind,
    ).toBe("allocated");
    expect(entrySituation({ ...base, itemState: "called", call: null }, NOW)).toEqual({
      kind: "turn",
      ticket: "C-001",
      station: null,
    });
  });
});

describe("minha fila clara: etapa, se já está na fila e o grupo (redesenho 2026-11-14)", () => {
  const NOW = Date.parse("2026-11-14T12:00:00.000Z");
  const today = {
    id: base.entryId,
    start: "2026-11-14T11:00:00.000Z",
    end: "2026-11-14T20:00:00.000Z",
    breaks: [],
    state: "open",
  };
  const tomorrow = {
    ...today,
    start: "2026-11-15T11:00:00.000Z",
    end: "2026-11-15T15:00:00.000Z",
    breaks: [],
    state: "planned",
  };
  const r = (en: MyEntry) => entrySummary(en, entrySituation(en, NOW), NOW);

  it("lista de espera e reserva: ainda NÃO está em fila nenhuma, grupo sem data", () => {
    const list = r({ ...base, state: "waiting", ticket: null, itemState: null });
    expect(list).toMatchObject({ inQueue: false, stage: 0, group: "no_date", badge: "lista de espera" });
    const reserve = r({ ...base, state: "in_reserve", ticket: null, itemState: null, session: tomorrow });
    expect(reserve).toMatchObject({ inQueue: false, stage: 0, group: "upcoming", badge: "na reserva" });
  });

  it("inscrito para amanhã: tem vaga mas ainda não está na fila; a fila de hoje é 'hoje'", () => {
    expect(r({ ...base, state: "confirmed", ticket: null, itemState: null, session: tomorrow })).toMatchObject({
      inQueue: false,
      stage: 1,
      group: "upcoming",
      badge: "inscrito",
    });
  });

  it("na fila em casa, na unidade e chamado: etapas 1, 2 e 3, grupo hoje", () => {
    const atHome = r({ ...base, session: today, estimate: { kind: "position", position: 3, minutes: 20 } });
    expect(atHome).toMatchObject({ inQueue: true, stage: 1, group: "today", badge: "na fila" });
    const inUnit = r({
      ...base,
      session: today,
      itemState: "present",
      estimate: { kind: "position", position: 1, minutes: 0 },
    });
    expect(inUnit).toMatchObject({ inQueue: true, stage: 2, badge: "na unidade" });
    const turn = r({ ...base, session: today, itemState: "called", call: { station: "Sala 1", at: today.start } });
    expect(turn).toMatchObject({ inQueue: true, stage: 3, badge: "sua vez" });
  });

  it("encerrados: atendido completa a trilha; cancelado e saiu não têm trilha", () => {
    expect(r({ ...base, session: today, state: "completed", itemState: "done_in_stage" })).toMatchObject({
      stage: 4,
      group: "closed",
    });
    expect(r({ ...base, state: "cancelled", itemState: null })).toMatchObject({ stage: null, group: "closed" });
  });

  it("remanejada: continua no serviço esperando nova data (não é encerrada)", () => {
    const rem = r({ ...base, session: today, state: "reassigned", itemState: "reassigned", ticket: null });
    expect(rem).toMatchObject({ inQueue: false, stage: 0, group: "no_date", badge: "nova data" });
  });
});

describe("faixa depois do 'não vou poder ir', pelo tipo da inscrição", () => {
  it("reserva, lista de espera e vaga", () => {
    expect(cancellationNotice({ kind: "reserve" })).toBe("você saiu da reserva.");
    expect(cancellationNotice({ kind: "list" })).toBe("você saiu da lista de espera.");
    expect(cancellationNotice({ kind: "confirmed" })).toBe("a vaga fica para outra pessoa.");
  });
});

describe("próximo passo, em uma frase (cartão, revisão 2026-11-14)", () => {
  const NOW = Date.parse("2026-11-14T12:00:00.000Z");
  const session = {
    id: base.entryId,
    start: "2026-11-14T17:00:00.000Z",
    end: "2026-11-14T21:00:00.000Z",
    breaks: [],
    state: "planned",
  };
  it("diz o que fazer agora, com o horário quando importa", () => {
    const signedUp = { ...base, state: "confirmed", ticket: null, itemState: null, session };
    expect(nextStep(signedUp, entrySituation(signedUp, NOW), NOW)).toBe(
      "a fila abre às 14h. até lá, pode esperar em casa.",
    );
    // No fuso da unidade: em Manaus (UTC−4) a mesma sessão abre às 13h, não às 14h de Brasília.
    const manaus = { ...signedUp, timeZone: "America/Manaus" };
    expect(nextStep(manaus, entrySituation(manaus, NOW), NOW)).toBe(
      "a fila abre às 13h. até lá, pode esperar em casa.",
    );
    const list = { ...base, state: "waiting", ticket: null, itemState: null };
    expect(nextStep(list, entrySituation(list, NOW), NOW)).toBe("a unidade vai marcar a data e te avisar.");
    const atHome = {
      ...base,
      session: { ...session, state: "open" },
      estimate: { kind: "position" as const, position: 3, minutes: 25 },
    };
    expect(nextStep(atHome, entrySituation(atHome, NOW), NOW)).toBe("pode esperar em casa. avisamos a hora de sair.");
  });
});

describe("triagem no app (fatia 3)", () => {
  const present = {
    ...base,
    itemState: "present" as const,
    estimate: { kind: "position" as const, position: 2, minutes: 5 },
  };

  it("RN-TRI-01/04: antes da triagem, 'primeiro a triagem'; depois, 'triagem feita'", () => {
    const before = { ...present, stage: "triage" as const };
    expect(nextStep(before, sit(before), 0)).toBe("você está na unidade. primeiro, a triagem: fique de olho na TV.");
    const after = { ...present, triaged: true };
    expect(nextStep(after, sit(after), 0)).toBe("triagem feita. agora, o atendimento: fique de olho na TV.");
    const atHome = {
      ...base,
      stage: "triage" as const,
      estimate: { kind: "position" as const, position: 3, minutes: 40 },
    };
    expect(nextStep(atHome, sit(atHome), 0)).toBe("pode esperar em casa. avisamos a hora de sair.");
  });

  it("H2: encaminhado à emergência não é 'atendimento concluído'", () => {
    const ref = {
      ...base,
      state: "completed",
      itemState: "done_in_stage" as const,
      stage: "triage" as const,
      referred: true,
    };
    expect(sit(ref)).toEqual({ kind: "referred" });
    expect(nextStep(ref, sit(ref), 0)).toBe(
      "a enfermagem encaminhou você para a emergência. siga a orientação da equipe.",
    );
    expect(entrySummary(ref, sit(ref), 0)).toMatchObject({ badge: "emergência", tone: "red", inQueue: false });
  });

  it("RN-PIORA-01 (H6): presente não refaz o questionário; a orientação é avisar no local e o 192", () => {
    expect(WORSENED_GUIDANCE).toMatch(/recepção ou a enfermagem/);
    expect(WORSENED_GUIDANCE).toMatch(/192/);
  });
});

describe("depois de recusar a data", () => {
  it("na lista de novo ou pedido encerrado, conforme a resposta da API", () => {
    expect(refusalNotice("waiting")).toBe("a vaga fica para outra pessoa. você continua na lista de espera.");
    expect(refusalNotice("reassigned")).toBe("a vaga fica para outra pessoa. você continua na lista de espera.");
    expect(refusalNotice("cancelled")).toBe(
      "a vaga fica para outra pessoa. como já era a segunda data recusada, o pedido foi encerrado. se ainda precisar, fale com a unidade.",
    );
  });
});

describe("cancelar: o que o botão diz e o que acontece", () => {
  it("alocada: sair da lista encerra o pedido; recusar só a data é o outro botão", () => {
    expect(cancellationText({ kind: "allocated" } as Situation)).toEqual({
      button: "sair da lista de espera",
      effect: "você sai da lista de espera.",
      hint: 'se só esta data não dá, toque em "não posso nesta data": você continua na lista.',
    });
  });
  it("na lista e na reserva, e quem tem a vaga do dia", () => {
    expect(cancellationText({ kind: "list" } as Situation)).toMatchObject({
      button: "sair da lista de espera",
      effect: "você sai da lista de espera.",
    });
    expect(cancellationText({ kind: "reserve" } as Situation)).toMatchObject({
      button: "não vou poder ir",
      effect: "você sai da reserva.",
    });
    expect(cancellationText({ kind: "waiting" } as Situation)).toEqual({
      button: "não vou poder ir",
      effect: "você perde esta vaga.",
      hint: "para outro dia, faça uma nova inscrição.",
    });
  });
});

describe("mensagens de erro no estilo do app (minúsculas)", () => {
  it("o texto do app vem primeiro; sem ele, o da API com a primeira letra minúscula", () => {
    expect(errorMessage(new ApiError(400, "invalid_qr", "QR vencido. Leia de novo o QR da unidade."))).toBe(
      "QR vencido. leia de novo o QR da unidade.",
    );
    expect(errorMessage(new ApiError(409, "session_closed", "Este atendimento já terminou."))).toBe(
      "este atendimento já foi encerrado.",
    );
    expect(errorMessage(new ApiError(409, "triage_closed"))).toBe(
      "a triagem deste atendimento fechou e ninguém novo entra por enquanto. tente de novo mais tarde ou escolha outro atendimento.",
    );
    expect(errorMessage(new ApiError(409, "limit_per_account", "Uma conta põe até 5 pessoas."))).toBe(
      "uma conta põe até 5 pessoas.",
    );
  });
});

describe("pausa da estação no app (RN-EST-06, fatia 4 da pausa)", () => {
  const MIN = 60_000;
  // 12:32 em Brasília.
  const T = Date.UTC(2026, 10, 25, 15, 32);
  const paused = (from: number, until: number | null, extra: Partial<MyEntry> = {}): MyEntry => ({
    ...base,
    ...extra,
    estimate: { kind: "position", position: 5, minutes: 70, pause: { from, until } },
  });

  it("em pausa: o título diz a volta (ou que não tem hora); sem hora de volta, não há tempo", () => {
    expect(entrySituation(paused(T - 10 * MIN, T + 60 * MIN), T)).toMatchObject({
      kind: "position",
      position: 5,
      minutes: 70,
      pause: { title: "pausa, volta às 13h32", started: true, noReturn: false },
    });
    expect(entrySituation(paused(T - 10 * MIN, null), T)).toMatchObject({
      pause: { title: "pausa por tempo indeterminado", started: true, noReturn: true },
    });
  });

  it("pausa à frente (começa antes da vez): diz quando começa", () => {
    expect(entrySituation(paused(T + 30 * MIN, T + 90 * MIN), T)).toMatchObject({
      pause: { title: "pausa às 13h02, volta às 14h02", started: false, noReturn: false },
    });
    expect(entrySituation(paused(T + 30 * MIN, null), T)).toMatchObject({
      pause: { title: "pausa às 13h02, sem hora de volta", started: false, noReturn: true },
    });
  });

  it("em pausa, o selo é 'em pausa' (amarelo); o próximo passo diz quando avisamos", () => {
    const withBack = paused(T - 10 * MIN, T + 60 * MIN);
    const s1 = entrySituation(withBack, T);
    expect(entrySummary(withBack, s1, T)).toMatchObject({ badge: "em pausa", tone: "yellow", stage: 1 });
    expect(nextStep(withBack, s1, T)).toBe("pode esperar em casa. avisamos a hora de sair.");
    const noBack = paused(T - 10 * MIN, null);
    expect(nextStep(noBack, entrySituation(noBack, T), T)).toBe("sem hora de volta: avisamos quando a fila andar.");
    // Já tinha recebido "saia de casa": com a pausa em curso, a pausa vence (ninguém está chamando).
    const left = paused(T - 10 * MIN, null, { leaveHome: true });
    const s2 = entrySituation(left, T);
    expect(entrySummary(left, s2, T)).toMatchObject({ badge: "em pausa" });
    expect(nextStep(left, s2, T)).toBe(
      "a unidade pausou. se já saiu, pode vir e esperar lá. avisamos quando a fila voltar.",
    );
    // Com hora de volta, também não manda quem já saiu ficar em casa.
    const leftBack = paused(T - 10 * MIN, T + 60 * MIN, { leaveHome: true });
    expect(nextStep(leftBack, entrySituation(leftBack, T), T)).toBe(
      "a unidade pausou. se já saiu, pode vir e esperar lá. avisamos quando a fila voltar.",
    );
    // Recebeu "saia de casa" e uma pausa marcada vai atrasar a vez: não manda sair agora.
    const ahead = paused(T + 30 * MIN, T + 90 * MIN, { leaveHome: true });
    const s3 = entrySituation(ahead, T);
    expect(nextStep(ahead, s3, T)).toBe(
      "a unidade pausa às 13h02. pode esperar em casa: avisamos quando for para vir.",
    );
    expect(entrySummary(ahead, s3, T)).toMatchObject({ badge: "na fila" });
    // Na unidade, segue "na unidade": a pessoa já está lá.
    const present = paused(T - 10 * MIN, null, { itemState: "present" });
    expect(entrySummary(present, entrySituation(present, T), T)).toMatchObject({ badge: "na unidade" });
  });

  it("opção C: na unidade, com a justificativa, a pausa antes da vez e quando é a vez", () => {
    const held = (until: number | null): MyEntry => ({
      ...base,
      itemState: "present",
      estimate: {
        kind: "position",
        position: 1,
        minutes: 60,
        pause: { from: T - MIN, until, beforeTurn: true, alone: true },
      },
    });
    const withBack = held(T + 60 * MIN);
    const s1 = entrySituation(withBack, T);
    expect(s1).toMatchObject({ pause: { beforeTurn: true, back: "13h32" } });
    expect(entrySummary(withBack, s1, T)).toMatchObject({ badge: "na unidade" });
    expect(nextStep(withBack, s1, T)).toBe(
      "a equipe precisou fazer uma pausa antes de chamar você. você não perdeu o lugar: a sua vez vem logo na volta, às 13h32, respeitando as prioridades da lei. se precisar sair, esteja de volta até esse horário. obrigado pela paciência.",
    );
    // Com outra pessoa segurada pela pausa na etapa, não promete que vem logo, mesmo em 1º (o mesmo que o push).
    const second: MyEntry = {
      ...withBack,
      estimate: {
        kind: "position",
        position: 1,
        minutes: 70,
        pause: { from: T - MIN, until: T + 60 * MIN, beforeTurn: true },
      },
    };
    expect(nextStep(second, entrySituation(second, T), T)).toBe(
      "a equipe precisou fazer uma pausa antes de chamar você. você não perdeu o lugar: quem chegou no prazo é atendido primeiro na volta, às 13h32. se precisar sair, esteja de volta até esse horário. obrigado pela paciência.",
    );
    const noBack = held(null);
    expect(nextStep(noBack, entrySituation(noBack, T), T)).toBe(
      "a equipe precisou fazer uma pausa antes de chamar você. você não perdeu o lugar: a sua vez vem logo quando o atendimento voltar, respeitando as prioridades da lei. avisamos por aqui quando for a hora. obrigado pela paciência.",
    );
  });
});
