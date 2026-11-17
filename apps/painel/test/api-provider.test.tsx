import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider, useApi } from "@/lib/api-context";

function fakeApi(): Api {
  const nothing = async () => undefined as never;
  return { get: nothing, post: nothing, patch: nothing, put: nothing, del: nothing };
}

function WhoUses({ expected }: { expected: Api }) {
  const api = useApi();
  return <p>{api === expected ? "api injetada" : "outra api"}</p>;
}

afterEach(cleanup);

describe("ApiProvider", () => {
  it("PD-31: useApi devolve o cliente injetado pelo provider", () => {
    const api = fakeApi();
    render(
      <ApiProvider api={api}>
        <WhoUses expected={api} />
      </ApiProvider>,
    );
    expect(screen.getByText("api injetada")).toBeDefined();
  });

  it("PD-31: useApi fora do provider falha com mensagem clara", () => {
    const api = fakeApi();
    expect(() => render(<WhoUses expected={api} />)).toThrow(/ApiProvider/);
  });
});
