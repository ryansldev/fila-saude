import { cenarioDaFila } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { UNIDADE } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let outraId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  outraId = (await c.pedir("POST", "/v1/painel/unidades", c.gestor, { ...UNIDADE, nome: "UBS Norte" })).corpo.id;
});
afterAll(() => orchestrator.derrubarMunicipios());

const resumo = async () => {
  const r = await c.pedir("GET", "/v1/painel/unidades/hoje", c.gestor);
  expect(r.status).toBe(200);
  return Object.fromEntries(
    r.corpo.map((x: { unidadeId: string; abertas: number; proximaAbertura: string | null }) => [x.unidadeId, x]),
  );
};

describe("resumo de hoje por unidade (troca de unidade no menu)", () => {
  it("planejada: quando abre; aberta: conta; unidade sem nada: zero e null", async () => {
    let r = await resumo();
    // A sessão do cenário começou há 1 min e ainda não abriu.
    expect(r[c.unidadeId]).toMatchObject({ abertas: 0, proximaAbertura: expect.any(String) });
    expect(Date.parse(r[c.unidadeId].proximaAbertura)).toBeLessThan(Date.now());
    expect(r[outraId]).toMatchObject({ abertas: 0, proximaAbertura: null });
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    r = await resumo();
    expect(r[c.unidadeId]).toMatchObject({ abertas: 1, proximaAbertura: null });
  });

  it("sem login, 401", async () => {
    expect((await orchestrator.pedirPainel(c.slug, "GET", "/v1/painel/unidades/hoje")).status).toBe(401);
  });
});
