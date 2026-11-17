import { describe, expect, it, vi } from "vitest";
import { type Api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/forms/errors";
import { leave } from "@/lib/session";

function apiWith(post: Api["post"]): Api {
  const nothing = async () => undefined as never;
  return { get: nothing, post, patch: nothing, put: nothing, del: nothing };
}

describe("sair", () => {
  it("encerra a sessão no better-auth do painel e vai para o login", async () => {
    const post = vi.fn(async () => ({ success: true })) as unknown as Api["post"];
    const navigate = vi.fn();
    await leave(apiWith(post), navigate);
    expect(post).toHaveBeenCalledWith("/v1/panel/auth/sign-out", {});
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("mesmo se a API falhar, volta para o login", async () => {
    const navigate = vi.fn();
    await leave(
      apiWith((async () => {
        throw new ApiError(0, "no_connection");
      }) as Api["post"]),
      navigate,
    );
    expect(navigate).toHaveBeenCalledWith("/login");
  });
});

describe("mensagens das remoções", () => {
  it("unidade em uso e remover a si mesmo explicam o motivo", () => {
    expect(errorMessage(new ApiError(409, "unit_has_sessions"))).toMatch(/sessões planejadas ou abertas/i);
    expect(errorMessage(new ApiError(409, "unit_has_entries", undefined, undefined, { activeEntries: 2 }))).toMatch(
      /2 pacientes/,
    );
    expect(errorMessage(new ApiError(409, "remove_self"))).toMatch(/você mesmo/i);
  });
});
