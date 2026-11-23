import { PUSH_CHANNEL } from "@fila-saude/schemas/push";
import { expoMessage, expoSenderWith, staleNotices, startSweep } from "infra/notices/sweep";
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
  const claim = (
    ids: string[],
    history: ReturnType<typeof n>[],
    awaited = new Set(["e1-care", "e2-care"]),
    waiting = new Map<string, string>(),
  ) =>
    staleNotices(
      history.filter((h) => ids.includes(h.id)),
      history,
      { awaited, waiting },
    );

  it("'saia de casa' e 'venha agora' só saem enquanto a pessoa espera na mesma etapa", () => {
    const leave = { id: "a", kind: "leave_home", state: "pending", entryId: "e1", key: "saia_de_casa:i1:care" };
    const come = { id: "b", kind: "come_now", state: "pending", entryId: "e1", key: "venha_agora:i1:care:5" };
    const run = (waiting: Map<string, string>) =>
      staleNotices([leave, come], [leave, come], { awaited: new Set(), waiting });
    expect(run(new Map([["i1", "care"]]))).toEqual(new Set());
    // Já chamada, atendida ou fora da fila:
    expect(run(new Map())).toEqual(new Set(["a", "b"]));
    // Passou para outra etapa:
    expect(run(new Map([["i1", "triage"]]))).toEqual(new Set(["a", "b"]));
  });

  it("chamada de quem a fila não espera mais (atendido, pulado, já na sala) não sai", () => {
    expect(claim(["a"], [n("a", "your_turn")], new Set())).toEqual(new Set(["a"]));
    expect(claim(["a"], [n("a", "recalled")], new Set(["e2-care"]))).toEqual(new Set(["a"]));
    expect(claim(["a"], [n("a", "your_turn")], new Set(["e1-care"]))).toEqual(new Set());
  });

  it("chamada de uma etapa que já passou (triagem) não sai quando a pessoa é chamada na sala", () => {
    const h = [n("a", "your_turn", "pending", "e1", "e1-triage")];
    expect(claim(["a"], h, new Set(["e1-care"]))).toEqual(new Set(["a"]));
  });

  it("'pulado' e 'a fila abriu' não dependem do estado da fila", () => {
    expect(claim(["a"], [n("a", "skipped")], new Set())).toEqual(new Set());
    expect(claim(["a"], [n("a", "queue_opened")], new Set())).toEqual(new Set());
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
      n("d", "queue_opened", "pending", null),
    ];
    expect(claim(["a", "b", "c", "d"], h)).toEqual(new Set(["b"]));
  });
});

describe("envio à Expo", () => {
  it("a Expo devolve um número de respostas diferente do lote: o lote todo falha (nada cai no aviso errado)", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }),
    }));
    try {
      const two = [
        { for: "ExponentPushToken[a]", title: "t", body: "b", data: {} },
        { for: "ExponentPushToken[b]", title: "t", body: "b", data: {} },
      ];
      const r = await expoSenderWith(1000)(two);
      expect(r).toEqual([
        { ok: false, error: "expo: 1 respostas para 2 avisos" },
        { ok: false, error: "expo: 1 respostas para 2 avisos" },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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

describe("desligar a varredura", () => {
  it("espera a rodada em andamento antes de liberar o fechamento dos bancos", async () => {
    let open = () => {};
    const gate = new Promise<void>((r) => {
      open = r;
    });
    let started = () => {};
    const running = new Promise<void>((r) => {
      started = r;
    });
    const stop = startSweep(
      async () => ["a"],
      async () => {
        started();
        await gate;
        return null;
      },
      () => {},
      async () => [],
      1,
    );
    await running;
    let stopped = false;
    const done = stop().then(() => {
      stopped = true;
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(stopped).toBe(false);
    open();
    await done;
    expect(stopped).toBe(true);
  });
});
