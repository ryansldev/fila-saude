import { coalesce, sendsAfter } from "infra/notices/send-now";
import { describe, expect, it } from "vitest";

describe("quais pedidos disparam o envio na hora", () => {
  it("qualquer escrita, mesmo com erro na resposta (a transação pode já ter gravado o aviso)", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect(sendsAfter(method)).toBe(true);
  });

  it("leitura: não", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) expect(sendsAfter(method)).toBe(false);
  });
});

describe("um envio por município de cada vez", () => {
  const gate = () => {
    let open = () => {};
    const done = new Promise<void>((r) => {
      open = r;
    });
    return { done, open };
  };

  it("pedidos durante um envio viram uma rodada a mais, não uma por pedido", async () => {
    const runs: string[] = [];
    const first = gate();
    const now = coalesce(() => {});
    let calls = 0;
    const run = async () => {
      calls++;
      runs.push(`rodada ${calls}`);
      if (calls === 1) await first.done;
    };
    now("a", run);
    now("a", run);
    now("a", run);
    expect(runs).toEqual(["rodada 1"]);
    first.open();
    await now.idle("a");
    expect(runs).toEqual(["rodada 1", "rodada 2"]);
  });

  it("a rodada a mais usa o pedido mais novo (o banco do município pode ter mudado)", async () => {
    const used: string[] = [];
    const hold = gate();
    const now = coalesce(() => {});
    now("a", async () => {
      used.push("pool 1");
      await hold.done;
    });
    now("a", async () => {
      used.push("pool 2");
    });
    now("a", async () => {
      used.push("pool 3");
    });
    hold.open();
    await now.idle("a");
    expect(used).toEqual(["pool 1", "pool 3"]);
  });

  it("depois de fechar, espera o que está em andamento e não começa outro envio", async () => {
    const runs: string[] = [];
    const hold = gate();
    const now = coalesce(() => {});
    now("a", async () => {
      runs.push("em andamento");
      await hold.done;
    });
    const closed = now.close();
    now("a", async () => {
      runs.push("depois de fechar");
    });
    now("b", async () => {
      runs.push("outro município depois de fechar");
    });
    hold.open();
    await closed;
    expect(runs).toEqual(["em andamento"]);
  });

  it("municípios diferentes não esperam um pelo outro", async () => {
    const runs: string[] = [];
    const hold = gate();
    const now = coalesce(() => {});
    now("a", async () => {
      runs.push("a");
      await hold.done;
    });
    now("b", async () => {
      runs.push("b");
    });
    expect(runs).toEqual(["a", "b"]);
    hold.open();
    await now.idle("a");
  });

  it("erro numa rodada vai para o log e não derruba as seguintes", async () => {
    const errors: unknown[] = [];
    const now = coalesce((e) => errors.push(e));
    now("a", async () => {
      throw new Error("expo fora do ar");
    });
    await now.idle("a");
    let ran = false;
    now("a", async () => {
      ran = true;
    });
    await now.idle("a");
    expect(errors).toHaveLength(1);
    expect(ran).toBe(true);
  });
});
