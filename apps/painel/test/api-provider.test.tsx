import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider, useApi } from "@/lib/api-context";

function apiFalsa(): Api {
  const nada = async () => undefined as never;
  return { get: nada, post: nada, patch: nada, put: nada, del: nada };
}

function QuemUsa({ esperada }: { esperada: Api }) {
  const api = useApi();
  return <p>{api === esperada ? "api injetada" : "outra api"}</p>;
}

afterEach(cleanup);

describe("ApiProvider", () => {
  it("PD-31: useApi devolve o cliente injetado pelo provider", () => {
    const api = apiFalsa();
    render(
      <ApiProvider api={api}>
        <QuemUsa esperada={api} />
      </ApiProvider>,
    );
    expect(screen.getByText("api injetada")).toBeDefined();
  });

  it("PD-31: useApi fora do provider falha com mensagem clara", () => {
    const api = apiFalsa();
    expect(() => render(<QuemUsa esperada={api} />)).toThrow(/ApiProvider/);
  });
});
