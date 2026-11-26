import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignalBand } from "@/components/signal-band";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function apiWith(get: (c: string) => Promise<unknown>): Api {
  const nothing = async () => undefined as never;
  return { get: get as Api["get"], post: nothing, patch: nothing, put: nothing, del: nothing };
}

const TV = { kind: "tv", id: "t1", name: null, since: new Date(Date.now() - 5 * 60_000).toISOString() };

describe("QP2: a faixa de alerta de sinal no painel", () => {
  it("a consulta que falha some com a faixa (não fica presa no último alerta)", async () => {
    vi.useFakeTimers();
    let n = 0;
    const api = apiWith(async () => {
      n++;
      if (n === 1) return [TV];
      throw new Error("sem internet");
    });
    render(
      <ApiProvider api={api}>
        <SignalBand unitId="u1" profiles={["reception"]} />
      </ApiProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("alert").textContent).toContain("TV sem sinal");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(n).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem ação da fila na unidade, nem consulta", async () => {
    const get = vi.fn(async () => [TV]);
    render(
      <ApiProvider api={apiWith(get)}>
        <SignalBand unitId="u1" profiles={[]} />
      </ApiProvider>,
    );
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
