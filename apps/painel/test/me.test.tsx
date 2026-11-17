import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { useMe } from "@/lib/session";

afterEach(cleanup);

function Shows() {
  const me = useMe();
  return <p>{me.state}</p>;
}

function apiWith(me: unknown): Api {
  const nothing = async () => undefined as never;
  return { get: (async () => me) as Api["get"], post: nothing, patch: nothing, put: nothing, del: nothing };
}

describe("useMe", () => {
  it("eu fora do contrato vira erro", async () => {
    render(
      <ApiProvider api={apiWith({ id: "x", name: "Ana", profiles: [{ profile: "patient", unitId: null }] })}>
        <Shows />
      </ApiProvider>,
    );
    expect(await screen.findByText("error")).toBeDefined();
  });
  it("eu no contrato autentica", async () => {
    render(
      <ApiProvider
        api={apiWith({
          id: "x",
          name: "Ana",
          login: "ana",
          unitLinks: [],
          roles: [],
          profiles: [{ profile: "sms_management", unitId: null }],
        })}
      >
        <Shows />
      </ApiProvider>,
    );
    expect(await screen.findByText("authenticated")).toBeDefined();
  });
});
