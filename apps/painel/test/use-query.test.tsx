import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { useQuery } from "@/lib/use-query";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function apiWith(get: (c: string) => Promise<unknown>): Api {
  const nothing = async () => undefined as never;
  return { get: get as Api["get"], post: nothing, patch: nothing, put: nothing, del: nothing };
}

let reload: () => void = () => {};
function Shows({ path }: { path: string | null }) {
  const c = useQuery<{ v: number }>(path, 1000);
  reload = c.reload;
  return <p>{c.detail ? `v${c.detail.v}` : "vazio"}</p>;
}

describe("useConsulta (revisão 2026-11-13)", () => {
  it("recarregar não apaga o dado (a tela não pisca nem perde a seleção)", async () => {
    let n = 0;
    let release: () => void = () => {};
    const api = apiWith(async () => {
      n++;
      if (n === 1) return { v: 1 };
      await new Promise<void>((r) => {
        release = r;
      });
      return { v: 2 };
    });
    render(
      <ApiProvider api={api}>
        <Shows path="/x" />
      </ApiProvider>,
    );
    expect(await screen.findByText("v1")).toBeDefined();
    act(() => reload());
    expect(screen.getByText("v1")).toBeDefined();
    await act(async () => release());
    expect(await screen.findByText("v2")).toBeDefined();
  });

  it("não sobrepõe consultas: a próxima só sai depois da anterior responder", async () => {
    vi.useFakeTimers();
    let inFlight = 0;
    let maximum = 0;
    const api = apiWith(async () => {
      inFlight++;
      maximum = Math.max(maximum, inFlight);
      await new Promise((r) => setTimeout(r, 2500));
      inFlight--;
      return { v: 1 };
    });
    render(
      <ApiProvider api={api}>
        <Shows path="/x" />
      </ApiProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(maximum).toBe(1);
  });
});
