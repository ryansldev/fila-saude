import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { useConsulta } from "@/lib/use-consulta";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function apiCom(get: (c: string) => Promise<unknown>): Api {
  const nada = async () => undefined as never;
  return { get: get as Api["get"], post: nada, patch: nada, put: nada, del: nada };
}

let recarregar: () => void = () => {};
function Mostra({ caminho }: { caminho: string | null }) {
  const c = useConsulta<{ v: number }>(caminho, 1000);
  recarregar = c.recarregar;
  return <p>{c.dado ? `v${c.dado.v}` : "vazio"}</p>;
}

describe("useConsulta (revisão 2026-11-13)", () => {
  it("recarregar não apaga o dado (a tela não pisca nem perde a seleção)", async () => {
    let n = 0;
    let soltar: () => void = () => {};
    const api = apiCom(async () => {
      n++;
      if (n === 1) return { v: 1 };
      await new Promise<void>((r) => {
        soltar = r;
      });
      return { v: 2 };
    });
    render(
      <ApiProvider api={api}>
        <Mostra caminho="/x" />
      </ApiProvider>,
    );
    expect(await screen.findByText("v1")).toBeDefined();
    act(() => recarregar());
    expect(screen.getByText("v1")).toBeDefined();
    await act(async () => soltar());
    expect(await screen.findByText("v2")).toBeDefined();
  });

  it("não sobrepõe consultas: a próxima só sai depois da anterior responder", async () => {
    vi.useFakeTimers();
    let emVoo = 0;
    let maximo = 0;
    const api = apiCom(async () => {
      emVoo++;
      maximo = Math.max(maximo, emVoo);
      await new Promise((r) => setTimeout(r, 2500));
      emVoo--;
      return { v: 1 };
    });
    render(
      <ApiProvider api={api}>
        <Mostra caminho="/x" />
      </ApiProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(maximo).toBe(1);
  });
});
