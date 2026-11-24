import type { Event } from "@fila-saude/domain";
import { noticeTarget, noticeText } from "infra/notices/outbox";
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
  });
});

describe("textos dos avisos da fila (AD-076)", () => {
  const ctx = { unit: "UBS Centro", ticket: "A12", station: () => "consultório 1" };
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
