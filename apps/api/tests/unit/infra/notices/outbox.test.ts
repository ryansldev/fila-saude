import type { Event } from "@fila-saude/domain";
import { hourText, noticeTarget, noticeText } from "infra/notices/outbox";
import { describe, expect, it } from "vitest";

describe("o item da fila na chave do aviso", () => {
  it("'sua vez' e rechamada: o item chamado", () => {
    expect(noticeTarget("sua_vez:item-1:1700000000000")).toEqual({ kind: "call", item: "item-1" });
    expect(noticeTarget("rechamada:item-2:1700000000000")).toEqual({ kind: "call", item: "item-2" });
  });

  it("'saia de casa', 'venha agora' e 'perdeu a vez': o item e a etapa em que ele espera", () => {
    expect(noticeTarget("saia_de_casa:item-1:care")).toEqual({ kind: "waiting", item: "item-1", stage: "care" });
    expect(noticeTarget("perdeu_a_vez:item-1:care:5")).toEqual({ kind: "waiting", item: "item-1", stage: "care" });
    expect(noticeTarget("venha_agora:item-1:triage:1700000000000")).toEqual({
      kind: "waiting",
      item: "item-1",
      stage: "triage",
    });
  });

  it("outras chaves: nenhum", () => {
    expect(noticeTarget("teste:123")).toBeNull();
    expect(noticeTarget("pulado:item-1:1")).toBeNull();
    expect(noticeTarget("fila_aberta:item-1")).toBeNull();
    expect(noticeTarget("pausa_antes:item-1:care:e1:7")).toEqual({ kind: "present", item: "item-1", stage: "care" });
  });
});

describe("textos dos avisos da fila (AD-076)", () => {
  const ctx = { unit: "UBS Centro", ticket: "A12", station: () => "Consultório 1", time: () => "13h32" };
  const ev = (kind: Event["kind"], data: Record<string, unknown>): Event =>
    ({ kind, itemId: "item-1", entryId: "ent-1", data }) as Event;

  it("'venha agora' diz o prazo para chegar e que, sem chegar, perde a vez", () => {
    expect(noticeText(ev("come_now", { stage: "care", at: 1, deadlineMin: 30 }), ctx)?.body).toBe(
      "você é o próximo na UBS Centro. chegue em até 30 min e leia o QR da TV, senão perde a vez.",
    );
  });

  it("'venha agora' para urgência confirmada não diz que perde a vez", () => {
    expect(noticeText(ev("come_now", { stage: "care", at: 1, deadlineMin: 30, losesTurn: false }), ctx)?.body).toBe(
      "você é o próximo na UBS Centro. chegue em até 30 min e leia o QR da TV.",
    );
  });

  it("1º 'não compareceu': a vez fica guardada; 2º: sai da fila", () => {
    expect(noticeText(ev("skipped", { skips: 1, for: "present", at: 1 }), ctx)?.body).toBe(
      "você continua na fila, logo depois dos próximos. fique de olho na TV.",
    );
    expect(noticeText(ev("skipped", { skips: 2, for: "left_queue", at: 1 }), ctx)?.body).toBe(
      "você saiu da fila de hoje. se estiver na unidade, fale com a recepção.",
    );
  });

  it("'perdeu a vez': o prazo acabou e, se vier, vai para o fim da fila", () => {
    const t = noticeText(ev("turn_lost", { stage: "care", at: 9, comeNowAt: 5 }), ctx);
    expect(t).toEqual({
      kind: "turn_lost",
      key: "perdeu_a_vez:item-1:care:5",
      title: "você perdeu a vez",
      body: "o prazo para chegar na UBS Centro acabou. se ainda vier, leia o QR da TV: você vai para o fim da fila.",
    });
  });
});

describe("justificativa da pausa antes da vez (opção C)", () => {
  const ctx = { unit: "UBS Centro", ticket: "A12", station: () => "Consultório 2", time: () => "13h32" };
  const ev = (data: Record<string, unknown>): Event =>
    ({ kind: "turn_after_pause", itemId: "item-1", entryId: "ent-1", stationId: "e1", data }) as Event;

  it("com volta: a sua vez vem logo na volta, com a hora e as prioridades da lei (OC8)", () => {
    const t = noticeText(ev({ until: 1, at: 7, stage: "care", first: true }), ctx);
    expect(t).toEqual({
      kind: "turn_after_pause",
      key: "pausa_antes:item-1:care:e1:7",
      title: "consultório 2 entrou em pausa",
      body: "a equipe precisou pausar antes de chamar você. a sua vez vem logo na volta, às 13h32, respeitando as prioridades da lei. se precisar sair, esteja de volta até esse horário. obrigado pela paciência.",
    });
  });

  it("com mais gente na mesma situação, não promete que é a primeira", () => {
    expect(noticeText(ev({ until: 1, at: 7, stage: "care", first: false }), ctx)?.body).toBe(
      "a equipe precisou pausar antes de chamar você. você não perdeu o lugar: quem chegou no prazo é atendido primeiro na volta, às 13h32. se precisar sair, esteja de volta até esse horário. obrigado pela paciência.",
    );
  });

  it("sem volta: avisamos quando for a hora", () => {
    expect(noticeText(ev({ until: null, at: 7, stage: "care", first: true }), ctx)?.body).toBe(
      "a equipe precisou pausar antes de chamar você. a sua vez vem logo quando o atendimento voltar, respeitando as prioridades da lei. avisamos por aqui quando for a hora. obrigado pela paciência.",
    );
  });

  it("a hora no fuso da unidade", () => {
    expect(hourText(Date.UTC(2026, 10, 12, 16, 32), "America/Sao_Paulo")).toBe("13h32");
    expect(hourText(Date.UTC(2026, 10, 12, 10, 5), "America/Sao_Paulo")).toBe("7h05");
  });
});
