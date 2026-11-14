import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { unidadesDoUsuario, unidadesParaAcao, useUnidadeAtual } from "@/lib/unidade-atual";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    localStorage.clear();
  } catch {}
});

const U1 = { id: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e61", nome: "UBS 1", fuso: "America/Sao_Paulo" };
const U2 = { id: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e62", nome: "UBS 2", fuso: "America/Sao_Paulo" };

function apiCom(unidades: unknown[]): Api {
  const nada = async () => undefined as never;
  return { get: (async () => unidades) as Api["get"], post: nada, patch: nada, put: nada, del: nada };
}

function Mostra() {
  const { unidades, atual, escolher } = useUnidadeAtual();
  return (
    <div>
      <p>total:{unidades.length}</p>
      <p>atual:{atual ?? "nenhuma"}</p>
      <button type="button" onClick={() => escolher(U2.id)}>
        escolher
      </button>
    </div>
  );
}

function montar(unidades: unknown[]) {
  render(
    <ApiProvider api={apiCom(unidades)}>
      <Mostra />
    </ApiProvider>,
  );
}

describe("unidade atual", () => {
  it("gestor vê todas; os outros, as das suas perfis", () => {
    expect(
      unidadesDoUsuario({
        id: "a",
        nome: "A",
        login: "a",
        vinculos: [],
        funcoes: [],
        perfis: [{ perfil: "gestao_sms", unidadeId: null }],
      }),
    ).toEqual({ todas: true, ids: [] });
    expect(
      unidadesDoUsuario({
        id: "a",
        nome: "A",
        login: "a",
        vinculos: [],
        funcoes: [],
        perfis: [
          { perfil: "gerente_ubs", unidadeId: U1.id },
          { perfil: "recepcao", unidadeId: U1.id },
        ],
      }),
    ).toEqual({ todas: false, ids: [U1.id] });
  });

  it("unidade atual: uma unidade já vem escolhida", async () => {
    montar([U1]);
    expect(await screen.findByText(`atual:${U1.id}`)).toBeDefined();
  });

  it("unidade atual: várias pedem escolha e a escolha fica guardada", async () => {
    montar([U1, U2]);
    expect(await screen.findByText("total:2")).toBeDefined();
    expect(screen.getByText("atual:nenhuma")).toBeDefined();
    fireEvent.click(screen.getByText("escolher"));
    expect(await screen.findByText(`atual:${U2.id}`)).toBeDefined();
    cleanup();
    montar([U1, U2]);
    expect(await screen.findByText(`atual:${U2.id}`)).toBeDefined();
  });

  it("unidade atual: localStorage indisponível não quebra", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    montar([U1, U2]);
    expect(await screen.findByText("total:2")).toBeDefined();
    fireEvent.click(screen.getByText("escolher"));
    expect(await screen.findByText(`atual:${U2.id}`)).toBeDefined();
  });
});

describe("unidades para a ação da página (revisão 2026-11-13)", () => {
  it("gerente em U1 e recepção em U2: na tela de sessões só U1; na fila, as duas", () => {
    const perfis = [
      { perfil: "gerente_ubs" as const, unidadeId: U1.id },
      { perfil: "recepcao" as const, unidadeId: U2.id },
    ];
    expect(unidadesParaAcao([U1, U2], perfis, ["configurar_servicos_sessoes_estacoes_tv"]).map((u) => u.id)).toEqual([
      U1.id,
    ]);
    expect(
      unidadesParaAcao([U1, U2], perfis, ["conferir_e_marcar_presenca", "abrir_cancelar_encerrar_sessao"]),
    ).toHaveLength(2);
    expect(
      unidadesParaAcao([U1, U2], [{ perfil: "gestao_sms", unidadeId: null }], ["criar_unidades_e_regras"]),
    ).toHaveLength(2);
  });
});
