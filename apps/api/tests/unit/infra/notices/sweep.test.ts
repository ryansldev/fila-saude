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

describe("chamadas que perderam a hora antes do envio (G14)", () => {
  // O histórico da entrada no banco, em ordem de criação, com qualquer estado (enviado, pendente, falhou).
  const n = (id: string, kind: string, entryId: string | null = "e1") => ({ id, kind, entryId });
  const claim = (ids: string[], history: ReturnType<typeof n>[]) =>
    staleNotices(
      history.filter((h) => ids.includes(h.id)),
      history,
    );

  it("das chamadas da entrada só vale a última: 'sua vez' e rechamadas no mesmo lote, vai a última", () => {
    const h = [n("a", "your_turn"), n("b", "recalled"), n("c", "recalled")];
    expect(claim(["a", "b", "c"], h)).toEqual(new Set(["a", "b"]));
  });

  it("chamada seguida de 'pulado' sai: vai só o 'pulado'", () => {
    const h = [n("a", "your_turn"), n("b", "recalled"), n("c", "skipped")];
    expect(claim(["a", "b", "c"], h)).toEqual(new Set(["a", "b"]));
  });

  it("'sua vez' que falhou e volta sozinho depois de um 'pulado' já enviado não sai", () => {
    const h = [n("a", "your_turn"), n("b", "skipped")];
    expect(claim(["a"], h)).toEqual(new Set(["a"]));
  });

  it("chamada que volta depois de uma rechamada já enviada não sai", () => {
    const h = [n("a", "your_turn"), n("b", "recalled")];
    expect(claim(["a"], h)).toEqual(new Set(["a"]));
  });

  it("rechamada depois de um 'sua vez' já enviado vale; chamada depois do 'pulado' também", () => {
    expect(claim(["b"], [n("a", "your_turn"), n("b", "recalled")])).toEqual(new Set());
    expect(claim(["b"], [n("a", "skipped"), n("b", "your_turn")])).toEqual(new Set());
  });

  it("cada entrada por si; avisos sem entrada e de outros tipos ficam", () => {
    const h = [n("a", "your_turn", "e1"), n("b", "recalled", "e2"), n("c", "skipped", "e2"), n("d", "come_now", null)];
    expect(claim(["a", "b", "c", "d"], h)).toEqual(new Set(["b"]));
  });
});
