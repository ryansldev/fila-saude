import { PUSH_CHANNEL } from "@fila-saude/schemas/push";
import { afterError, expoMessage, expoSenderWith, queueFrom, staleNotices, startSweep } from "infra/notices/sweep";
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
    // Os dois atrasados juntos: vai só o mais novo ("venha agora").
    expect(run(new Map([["i1", "care"]]))).toEqual(new Set(["a"]));
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

  it("'saia de casa' depois de um 'venha agora' da mesma etapa que ainda vale não sai", () => {
    const leave = { id: "a", kind: "leave_home", state: "pending", entryId: "e1", key: "saia_de_casa:i1:care" };
    const come = (state: string, stage = "care") => ({
      id: "b",
      kind: "come_now",
      state,
      entryId: "e1",
      key: `venha_agora:i1:${stage}:5`,
    });
    const queue = { awaited: new Set<string>(), waiting: new Map([["i1", "care"]]) };
    expect(staleNotices([leave], [leave, come("sent")], queue)).toEqual(new Set(["a"]));
    expect(staleNotices([leave], [leave, come("pending")], queue)).toEqual(new Set(["a"]));
    expect(staleNotices([leave], [leave, come("failed")], queue)).toEqual(new Set());
    expect(staleNotices([leave], [leave, come("sent", "triage")], queue)).toEqual(new Set());
  });

  it("'pulado' antigo não sai depois de uma chamada mais nova, em qualquer estado (a pessoa foi chamada de novo)", () => {
    for (const state of ["sent", "pending", "failed", "stale"])
      expect(claim(["a"], [n("a", "skipped"), n("b", "your_turn", state)])).toEqual(new Set(["a"]));
    expect(claim(["a"], [n("a", "skipped")])).toEqual(new Set());
  });

  it("'venha agora' antigo não sai depois de outro 'venha agora' da mesma etapa que ainda vale ('Vou sair' recomeça)", () => {
    const old1 = { id: "a", kind: "come_now", state: "pending", entryId: "e1", key: "venha_agora:i1:care:1" };
    const new1 = (state: string) => ({ id: "b", kind: "come_now", state, entryId: "e1", key: "venha_agora:i1:care:9" });
    const queue = { awaited: new Set<string>(), waiting: new Map([["i1", "care"]]) };
    expect(staleNotices([old1], [old1, new1("sent")], queue)).toEqual(new Set(["a"]));
    expect(staleNotices([old1], [old1, new1("failed")], queue)).toEqual(new Set());
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
  it("200 e o corpo trava: depois do prazo do corpo conta como enviado (o desligamento não fica preso)", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }));
    try {
      const r = await expoSenderWith(20)([{ for: "ExponentPushToken[x]", title: "t", body: "b", data: {} }]);
      expect(r).toEqual([{ ok: true }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a Expo aceitou (200) mas o corpo não chega: conta como enviado, sem reenviar o lote todo", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("corpo interrompido");
      },
    }));
    try {
      const r = await expoSenderWith(1000)([{ for: "ExponentPushToken[x]", title: "t", body: "b", data: {} }]);
      expect(r).toEqual([{ ok: true }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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

describe("o estado da fila para os avisos (AD-074)", () => {
  const day = (state: string, items: { id: string; state: string; stage?: string }[], calls: object[] = []) =>
    ({ state, items: items.map((i) => ({ stage: "care", ...i })), calls }) as unknown as Parameters<
      typeof queueFrom
    >[0][number];

  it("chamados sem 'Compareceu' e quem está em casa, por etapa", () => {
    const q = queueFrom([
      day(
        "open",
        [
          { id: "a", state: "called" },
          { id: "b", state: "remote", stage: "triage" },
          { id: "c", state: "present" },
        ],
        [{ itemId: "a", stage: "care", stationId: "e1", at: 1 }],
      ),
    ]);
    expect(q.awaited).toEqual(new Set(["a"]));
    expect(q.waiting).toEqual(new Map([["b", "triage"]]));
  });

  it("sessão fechada ou cancelada não espera ninguém", () => {
    const q = queueFrom([
      day(
        "closed",
        [
          { id: "a", state: "called" },
          { id: "b", state: "remote" },
        ],
        [{ itemId: "a", stage: "care", stationId: "e1", at: 1 }],
      ),
      day("cancelled", [{ id: "c", state: "remote" }]),
    ]);
    expect(q.awaited).toEqual(new Set());
    expect(q.waiting).toEqual(new Map());
  });
});

describe("erro no meio do envio", () => {
  const now = 1_000_000;

  it("antes de chamar a Expo: conta como tentativa, com a espera crescente (sem martelar a cada pedido)", () => {
    expect(afterError(false, 0, now)).toEqual({
      attempts: 1,
      state: "pending",
      nextAttemptAt: new Date(now + 2 * 60_000),
    });
    expect(afterError(false, 2, now)).toEqual({
      attempts: 3,
      state: "pending",
      nextAttemptAt: new Date(now + 8 * 60_000),
    });
    expect(afterError(false, 4, now)?.state).toBe("failed");
  });

  it("depois de chamar a Expo: conta a tentativa mas deixa a reserva vencer (o aviso pode já ter chegado)", () => {
    expect(afterError(true, 0, now)).toEqual({ attempts: 1, state: "pending" });
    // Esgotado depois da Expo: talvez tenha chegado; não é "failed" (falha de entrega).
    expect(afterError(true, 4, now)).toEqual({ attempts: 5, state: "unconfirmed" });
  });
});
