import { cenarioDaFila, inscreverPessoa } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let t1: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila({ triagem: true });
  t1 = c.t1 as string;
  const recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
  const ids: Record<string, string> = {};
  for (const nome of ["Ana Souza", "Bruno Lima", "Carla Dias"])
    ids[nome] = (await inscreverPessoa(c.slug, c.sessaoId, nome)).id;
  await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
  for (const n of ["Ana Souza", "Bruno Lima"]) {
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
      entradaId: ids[n],
      resultado: "confere",
    });
  }
});
afterAll(() => orchestrator.derrubarMunicipios());

const op = (estacaoId: string) => c.pedir("GET", `/v1/painel/estacoes/${estacaoId}/operacao`, c.enfermeiro);
const cmd = (estacaoId: string, comando: string, corpo: unknown = {}) =>
  c.pedir("POST", `/v1/painel/estacoes/${estacaoId}/${comando}`, c.enfermeiro, corpo);

describe("estação: compareceu e a fila à vista", () => {
  it("fila vazia: sem próximos, ninguém a caminho, sem mais antigo", async () => {
    const r = await op(c.e1);
    expect(r.corpo).toMatchObject({ proximos: [], aCaminho: [], maisAntigo: null });
  });

  it("a fila da triagem: primeiros nomes na ordem de chamada e quem está a caminho", async () => {
    const r = await op(t1);
    expect(r.corpo.proximos.map((p: { nome: string }) => p.nome)).toEqual(["Ana", "Bruno"]);
    expect(r.corpo.proximos[0]).toMatchObject({ senha: expect.any(String), presenteDesde: expect.any(String) });
    expect(r.corpo.aCaminho).toEqual([{ senha: expect.any(String), nome: "Carla" }]);
    expect(r.corpo.maisAntigo).toMatchObject({ presenteDesde: expect.any(String), tempoAlvoMin: 30 });
  });

  it("chamado sem compareceu: a triagem não classifica", async () => {
    const r = await cmd(t1, "chamar");
    expect(r.corpo.chamado).toMatchObject({ nome: "Ana Souza", compareceuEm: null, prioridade: [] });
    expect(r.corpo.proximos.map((p: { nome: string }) => p.nome)).toEqual(["Bruno"]);
    const f = await cmd(t1, "finalizar", { riscoConfirmado: "urgente" });
    expect(f.status).toBe(409);
    expect(f.corpo).toMatchObject({ erro: "sem_comparecimento", mensagem: "Marque Compareceu antes de classificar." });
  });

  it("compareceu, desfazer e de novo; depois disso não rechama", async () => {
    const a = await cmd(t1, "compareceu");
    expect(a.status).toBe(200);
    expect(a.corpo.chamado.compareceuEm).toEqual(expect.any(String));
    expect((await cmd(t1, "desfazer-compareceu")).corpo.chamado.compareceuEm).toBeNull();
    await cmd(t1, "compareceu");
    expect((await cmd(t1, "rechamar")).status).toBe(409);
  });

  it("com compareceu a triagem fecha; no atendimento o alvo é o da cor confirmada", async () => {
    expect((await cmd(t1, "finalizar", { riscoConfirmado: "urgente" })).status).toBe(200);
    const r = await op(c.e1);
    expect(r.corpo.proximos.map((p: { nome: string }) => p.nome)).toEqual(["Ana"]);
    expect(r.corpo.maisAntigo).toMatchObject({ tempoAlvoMin: 60 });
  });
});
