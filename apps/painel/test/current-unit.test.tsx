import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { unitsForAction, useCurrentUnit, userUnits } from "@/lib/current-unit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    localStorage.clear();
  } catch {}
});

const U1 = { id: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e61", name: "UBS 1", timeZone: "America/Sao_Paulo" };
const U2 = { id: "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e62", name: "UBS 2", timeZone: "America/Sao_Paulo" };

function apiWith(units: unknown[]): Api {
  const nothing = async () => undefined as never;
  return { get: (async () => units) as Api["get"], post: nothing, patch: nothing, put: nothing, del: nothing };
}

function Shows() {
  const { units, current, choose } = useCurrentUnit();
  return (
    <div>
      <p>total:{units.length}</p>
      <p>atual:{current ?? "nenhuma"}</p>
      <button type="button" onClick={() => choose(U2.id)}>
        escolher
      </button>
    </div>
  );
}

function build(units: unknown[]) {
  render(
    <ApiProvider api={apiWith(units)}>
      <Shows />
    </ApiProvider>,
  );
}

describe("unidade atual", () => {
  it("gestor vê todas; os outros, as das suas perfis", () => {
    expect(
      userUnits({
        id: "a",
        name: "A",
        login: "a",
        unitLinks: [],
        roles: [],
        profiles: [{ profile: "sms_management", unitId: null }],
      }),
    ).toEqual({ all: true, ids: [] });
    expect(
      userUnits({
        id: "a",
        name: "A",
        login: "a",
        unitLinks: [],
        roles: [],
        profiles: [
          { profile: "unit_manager", unitId: U1.id },
          { profile: "reception", unitId: U1.id },
        ],
      }),
    ).toEqual({ all: false, ids: [U1.id] });
  });

  it("unidade atual: uma unidade já vem escolhida", async () => {
    build([U1]);
    expect(await screen.findByText(`atual:${U1.id}`)).toBeDefined();
  });

  it("unidade atual: com várias, começa na primeira (troca no menu) e a escolha fica guardada", async () => {
    build([U1, U2]);
    expect(await screen.findByText("total:2")).toBeDefined();
    expect(await screen.findByText(`atual:${U1.id}`)).toBeDefined();
    fireEvent.click(screen.getByText("escolher"));
    expect(await screen.findByText(`atual:${U2.id}`)).toBeDefined();
    cleanup();
    build([U1, U2]);
    expect(await screen.findByText(`atual:${U2.id}`)).toBeDefined();
  });

  it("unidade atual: localStorage indisponível não quebra", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    build([U1, U2]);
    expect(await screen.findByText("total:2")).toBeDefined();
    fireEvent.click(screen.getByText("escolher"));
    expect(await screen.findByText(`atual:${U2.id}`)).toBeDefined();
  });
});

describe("unidades para a ação da página (revisão 2026-11-13)", () => {
  it("gerente em U1 e recepção em U2: na tela de sessões só U1; na fila, as duas", () => {
    const profiles = [
      { profile: "unit_manager" as const, unitId: U1.id },
      { profile: "reception" as const, unitId: U2.id },
    ];
    expect(unitsForAction([U1, U2], profiles, ["configure_services_sessions_stations_tv"]).map((u) => u.id)).toEqual([
      U1.id,
    ]);
    expect(
      unitsForAction([U1, U2], profiles, ["verify_and_mark_attendance", "open_cancel_close_session"]),
    ).toHaveLength(2);
    expect(
      unitsForAction([U1, U2], [{ profile: "sms_management", unitId: null }], ["create_units_and_rules"]),
    ).toHaveLength(2);
  });
});
