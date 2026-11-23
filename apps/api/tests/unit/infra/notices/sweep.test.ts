import { PUSH_CHANNEL } from "@fila-saude/schemas/push";
import { expoMessage, staleNotices } from "infra/notices/sweep";
import { describe, expect, it } from "vitest";

describe("mensagem para a Expo", () => {
  it("vai pelo canal Android da fila (importância máxima no app), com som e prioridade alta", () => {
    expect(expoMessage({ for: "ExponentPushToken[x]", title: "é a sua vez", body: "sala 1", data: {} })).toEqual({
      to: "ExponentPushToken[x]",
      title: "é a sua vez",
      body: "sala 1",
      data: {},
      sound: "default",
      priority: "high",
      channelId: PUSH_CHANNEL,
    });
  });
});

describe("chamadas que perderam a hora antes do envio (a varredura junta o último minuto)", () => {
  const n = (id: string, kind: string, entryId: string | null = "e1") => ({ id, kind, entryId });

  it("rechamadas pendentes junto de uma chamada ainda não enviada saem: vai só a primeira", () => {
    expect(staleNotices([n("a", "your_turn"), n("b", "recalled"), n("c", "recalled")])).toEqual(new Set(["b", "c"]));
  });

  it("chamada ou rechamada seguida de 'pulado' sai: vai só o 'pulado'", () => {
    expect(staleNotices([n("a", "your_turn"), n("b", "recalled"), n("c", "skipped")])).toEqual(new Set(["a", "b"]));
  });

  it("chamada depois do 'pulado' (chamado de novo mais tarde) vale", () => {
    expect(staleNotices([n("a", "skipped"), n("b", "your_turn")])).toEqual(new Set());
  });

  it("cada entrada por si; avisos sem entrada e de outros tipos ficam", () => {
    expect(
      staleNotices([
        n("a", "your_turn", "e1"),
        n("b", "recalled", "e2"),
        n("c", "skipped", "e2"),
        n("d", "come_now", null),
      ]),
    ).toEqual(new Set(["b"]));
    expect(staleNotices([n("a", "recalled")])).toEqual(new Set());
  });
});
