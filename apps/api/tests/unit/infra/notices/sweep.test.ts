import { PUSH_CHANNEL } from "@fila-saude/schemas/push";
import { expoMessage } from "infra/notices/sweep";
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
