import { cenarioDaFila, inscreverPessoa } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, UNIDADE, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let recepcao: string;
let curativosId: string;
const entradas: Record<string, string> = {};

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  recepcao = (await usuarioLogado(c.slug, c.gestor, "recep", ocupacao(c.unidadeId, "recepcao"))).cookie;
  // Um segundo serviço com sessão hoje, para a fila da unidade inteira.
  const servico = (
    await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/servicos`, c.admin, {
      nome: "Curativos",
      prefixo: "V",
      exigeTriagem: false,
      modo: "livre",
      tempoMedioMin: {},
    })
  ).corpo.id as string;
  const sala = (
    await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/estacoes`, c.admin, {
      nome: "Sala de procedimentos",
      etapa: "atendimento",
      servicos: [servico],
    })
  ).corpo.id as string;
  const agora = Date.now();
  curativosId = (
    await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/sessoes`, c.admin, {
      servicoId: servico,
      inicio: new Date(agora - 60_000).toISOString(),
      fim: new Date(agora + 3 * 3600_000).toISOString(),
      vagas: 10,
      visibilidade: "publica",
      dispensaPreCadastro: false,
      profissional: null,
      estacoes: [sala],
    })
  ).corpo.id as string;
  entradas.ana = (await inscreverPessoa(c.slug, c.sessaoId, "Ana Clínico")).id;
  entradas.bia = (await inscreverPessoa(c.slug, c.sessaoId, "Bia Clínico")).id;
  entradas.caio = (await inscreverPessoa(c.slug, curativosId, "Caio Curativo")).id;
  for (const s of [c.sessaoId, curativosId]) await c.pedir("POST", `/v1/painel/sessoes/${s}/abrir`, c.admin);
});
afterAll(() => orchestrator.derrubarMunicipios());

const filaDeHoje = (cookie: string) => c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/fila-de-hoje`, cookie);

describe("fila de hoje da unidade inteira (Fila do dia, caminho C)", () => {
  it("F1: só quem é da equipe da unidade", async () => {
    expect((await filaDeHoje(recepcao)).status).toBe(200);
    const outra = (await c.pedir("POST", "/v1/painel/unidades", c.gestor, { ...UNIDADE, nome: "UBS Norte" })).corpo
      .id as string;
    const deFora = (await usuarioLogado(c.slug, c.gestor, "outra", ocupacao(outra, "recepcao"))).cookie;
    expect((await filaDeHoje(deFora)).status).toBe(403);
  });

  it("as sessões de hoje com as contagens, e as pessoas das duas com sessão e serviço", async () => {
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
      entradaId: entradas.ana,
      resultado: "confere",
    });
    const r = await filaDeHoje(recepcao);
    const porServico = Object.fromEntries(
      r.corpo.sessoes.map((s: { servico: string; contagens: unknown }) => [s.servico, s.contagens]),
    );
    expect(porServico).toEqual({
      Clínico: { naFila: 2, naUnidade: 1, aCaminho: 1, chamados: 0, atendidos: 0 },
      Curativos: { naFila: 1, naUnidade: 0, aCaminho: 1, chamados: 0, atendidos: 0 },
    });
    const caio = r.corpo.itens.find((i: { nome: string }) => i.nome === "Caio Curativo");
    expect(caio).toMatchObject({ sessaoId: curativosId, servico: "Curativos", desde: null, estacao: null });
    const ana = r.corpo.itens.find((i: { nome: string }) => i.nome === "Ana Clínico");
    expect(ana).toMatchObject({ sessaoId: c.sessaoId, servico: "Clínico", estado: "presente" });
    expect(Date.parse(ana.desde)).toBeLessThanOrEqual(Date.parse(r.corpo.agora));
    expect(ana.documento.cpf).toMatch(/^•••\.\d{3}\.\d{3}-••$/);
  });

  it("o chamado traz a hora da chamada e a sala", async () => {
    await c.pedir("POST", `/v1/painel/estacoes/${c.e1}/chamar`, c.enfermeiro, {});
    const r = await filaDeHoje(recepcao);
    const ana = r.corpo.itens.find((i: { nome: string }) => i.nome === "Ana Clínico");
    expect(ana).toMatchObject({ estado: "chamado", estacao: "Sala 1" });
    expect(ana.desde).toEqual(expect.any(String));
    expect(r.corpo.sessoes.find((s: { servico: string }) => s.servico === "Clínico").contagens.chamados).toBe(1);
  });
});
