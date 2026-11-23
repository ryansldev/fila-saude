import { PUSH_CHANNEL } from "@fila-saude/schemas/push";
import { expoMessage, expoSenderWith, staleNotices } from "infra/notices/sweep";
import { describe, expect, it, vi } from "vitest";

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

describe("chamadas que perderam a hora antes do envio (AD-074)", () => {
  // O histórico da entrada no banco, em ordem de criação, com o estado de cada aviso.
  // A chave do aviso leva o item da fila (`sua_vez:<item>:<hora>`), como o outbox grava.
  const n = (id: string, kind: string, state = "pending", entryId: string | null = "e1", item = `${entryId}-care`) => ({
    id,
    kind,
    state,
    entryId,
    key: `${kind === "recalled" ? "rechamada" : kind === "your_turn" ? "sua_vez" : kind}:${item}:1`,
  });
  // Itens que a fila ainda espera entrar na sala (`awaitedItems` do domínio).
  const claim = (ids: string[], history: ReturnType<typeof n>[], awaited = new Set(["e1-care", "e2-care"])) =>
    staleNotices(
      history.filter((h) => ids.includes(h.id)),
      history,
      awaited,
    );

  it("chamada de quem a fila não espera mais (atendido, pulado, já na sala) não sai", () => {
    expect(claim(["a"], [n("a", "your_turn")], new Set())).toEqual(new Set(["a"]));
    expect(claim(["a"], [n("a", "recalled")], new Set(["e2-care"]))).toEqual(new Set(["a"]));
    expect(claim(["a"], [n("a", "your_turn")], new Set(["e1-care"]))).toEqual(new Set());
  });

  it("chamada de uma etapa que já passou (triagem) não sai quando a pessoa é chamada na sala", () => {
    const h = [n("a", "your_turn", "pending", "e1", "e1-triage")];
    expect(claim(["a"], h, new Set(["e1-care"]))).toEqual(new Set(["a"]));
  });

  it("outros avisos não dependem de a pessoa estar chamada", () => {
    expect(claim(["a"], [n("a", "skipped")], new Set())).toEqual(new Set());
    expect(claim(["a"], [n("a", "come_now")], new Set())).toEqual(new Set());
  });

  it("chamada seguida de outra já enviada ou ainda pendente (no lote, em outra rodada ou esperando nova tentativa) não sai", () => {
    expect(claim(["a"], [n("a", "your_turn"), n("b", "recalled", "sent")])).toEqual(new Set(["a"]));
    expect(claim(["a"], [n("a", "your_turn"), n("b", "recalled", "pending")])).toEqual(new Set(["a"]));
    // Atrasadas juntas (a Expo caiu): vai só a última, não uma rajada.
    expect(claim(["a", "b", "c"], [n("a", "your_turn"), n("b", "recalled"), n("c", "recalled")])).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("chamada mais nova que desistiu ou também perdeu a hora não tira a anterior", () => {
    expect(claim(["a"], [n("a", "your_turn"), n("b", "recalled", "failed")])).toEqual(new Set());
    expect(claim(["a"], [n("a", "your_turn"), n("b", "recalled", "stale")])).toEqual(new Set());
    expect(claim(["a"], [n("a", "your_turn"), n("b", "recalled", "no_device")])).toEqual(new Set());
  });

  it("chamada seguida de 'pulado' (em qualquer estado) não sai", () => {
    expect(claim(["a"], [n("a", "your_turn"), n("b", "skipped", "sent")])).toEqual(new Set(["a"]));
    expect(claim(["a", "b"], [n("a", "your_turn"), n("b", "skipped")])).toEqual(new Set(["a"]));
  });

  it("chamada depois do 'pulado' (chamado de novo mais tarde) vale", () => {
    expect(claim(["b"], [n("a", "skipped", "sent"), n("b", "your_turn")])).toEqual(new Set());
  });

  it("cada entrada por si; avisos sem entrada e de outros tipos ficam", () => {
    const h = [
      n("a", "your_turn", "pending", "e1"),
      n("b", "recalled", "pending", "e2"),
      n("c", "skipped", "pending", "e2"),
      n("d", "come_now", "pending", null),
    ];
    expect(claim(["a", "b", "c", "d"], h)).toEqual(new Set(["b"]));
  });
});

describe("envio à Expo", () => {
  it("desiste da Expo que não responde (o desligamento da API não fica preso)", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("tempo esgotado")))),
    );
    try {
      const r = await expoSenderWith(20)([{ for: "ExponentPushToken[x]", title: "t", body: "b", data: {} }]);
      expect(r).toEqual([{ ok: false, error: "tempo esgotado" }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
