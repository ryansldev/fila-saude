import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { useEu } from "@/lib/sessao";

afterEach(cleanup);

function Mostra() {
  const eu = useEu();
  return <p>{eu.estado}</p>;
}

function apiCom(eu: unknown): Api {
  const nada = async () => undefined as never;
  return { get: (async () => eu) as Api["get"], post: nada, patch: nada, put: nada, del: nada };
}

describe("useEu", () => {
  it("eu fora do contrato vira erro", async () => {
    render(
      <ApiProvider api={apiCom({ id: "x", nome: "Ana", perfis: [{ perfil: "paciente", unidadeId: null }] })}>
        <Mostra />
      </ApiProvider>,
    );
    expect(await screen.findByText("erro")).toBeDefined();
  });
  it("eu no contrato autentica", async () => {
    render(
      <ApiProvider
        api={apiCom({
          id: "x",
          nome: "Ana",
          login: "ana",
          vinculos: [],
          funcoes: [],
          perfis: [{ perfil: "gestao_sms", unidadeId: null }],
        })}
      >
        <Mostra />
      </ApiProvider>,
    );
    expect(await screen.findByText("autenticado")).toBeDefined();
  });
});
