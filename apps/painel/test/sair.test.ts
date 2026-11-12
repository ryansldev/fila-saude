import { describe, expect, it, vi } from "vitest";
import { type Api, ErroDaApi } from "@/lib/api";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { sair } from "@/lib/sessao";

function apiCom(post: Api["post"]): Api {
  const nada = async () => undefined as never;
  return { get: nada, post, patch: nada, put: nada, del: nada };
}

describe("sair", () => {
  it("encerra a sessão no better-auth do painel e vai para o login", async () => {
    const post = vi.fn(async () => ({ success: true })) as unknown as Api["post"];
    const navegar = vi.fn();
    await sair(apiCom(post), navegar);
    expect(post).toHaveBeenCalledWith("/v1/painel/auth/sign-out", {});
    expect(navegar).toHaveBeenCalledWith("/login");
  });

  it("mesmo se a API falhar, volta para o login", async () => {
    const navegar = vi.fn();
    await sair(
      apiCom((async () => {
        throw new ErroDaApi(0, "sem_conexao");
      }) as Api["post"]),
      navegar,
    );
    expect(navegar).toHaveBeenCalledWith("/login");
  });
});

describe("mensagens das remoções", () => {
  it("unidade em uso e remover a si mesmo explicam o motivo", () => {
    expect(mensagemDoErro(new ErroDaApi(409, "unidade_com_sessoes"))).toMatch(/sessões planejadas ou abertas/i);
    expect(
      mensagemDoErro(new ErroDaApi(409, "unidade_com_entradas", undefined, undefined, { entradasAtivas: 2 })),
    ).toMatch(/2 pacientes/);
    expect(mensagemDoErro(new ErroDaApi(409, "remover_a_si_mesmo"))).toMatch(/você mesmo/i);
  });
});
