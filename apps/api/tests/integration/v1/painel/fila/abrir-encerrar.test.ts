import { cenarioDaFila, inscreverPessoa } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("abrir, ver a fila e encerrar a sessão (T3.4, T3.9)", () => {
  it("RN-FILA-01: abrir põe as confirmadas na fila, remotas e numeradas pela inscrição", async () => {
    await inscreverPessoa(c.slug, c.sessaoId, "Ana Lima");
    await inscreverPessoa(c.slug, c.sessaoId, "Bruno Reis");
    const sem = await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.enfermeiro);
    expect(sem.status).toBe(403);
    const r = await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    expect(r.status).toBe(200);
    expect(r.corpo.sessao.estado).toBe("aberta");
    expect(
      r.corpo.itens.map((i: { senha: string; nome: string; estado: string }) => [i.senha, i.nome, i.estado]),
    ).toEqual([
      ["C-001", "Ana Lima", "remoto"],
      ["C-002", "Bruno Reis", "remoto"],
    ]);
    expect((await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin)).status).toBe(409);
  });

  it("inscrição com a sessão aberta entra direto na fila com o próximo número", async () => {
    await inscreverPessoa(c.slug, c.sessaoId, "Carla Dias");
    const fila = await c.pedir("GET", `/v1/painel/sessoes/${c.sessaoId}/fila`, c.enfermeiro);
    expect(fila.status).toBe(200);
    expect(fila.corpo.itens.at(-1)).toMatchObject({ senha: "C-003", nome: "Carla Dias", estado: "remoto" });
  });

  it("RN-SES-02: encerrar remaneja quem não teve a vez passada; sessão fica encerrada", async () => {
    const r = await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/encerrar`, c.admin);
    expect(r.status).toBe(200);
    expect(r.corpo.sessao.estado).toBe("encerrada");
    expect(new Set(r.corpo.itens.map((i: { estado: string }) => i.estado))).toEqual(new Set(["remanejado"]));
    expect((await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/encerrar`, c.admin)).status).toBe(409);
  });
});
