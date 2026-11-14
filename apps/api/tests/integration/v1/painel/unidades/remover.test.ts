import { entrada } from "infra/database/municipal/schema/entrada";
import { entrarNaLista } from "infra/fila/entradas";
import orchestrator from "tests/orchestrator";
import { gerente, municipioComUnidade, ocupacao, UNIDADE, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let gestor: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, gestor } = await municipioComUnidade());
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
const novaUnidade = async (nome: string) =>
  (await pedir("POST", "/v1/painel/unidades", gestor, { ...UNIDADE, nome })).corpo.id as string;
const servicoEm = async (cookie: string, unidadeId: string) =>
  (
    await pedir("POST", `/v1/painel/unidades/${unidadeId}/servicos`, cookie, {
      nome: "Odonto",
      prefixo: "O",
      exigeTriagem: false,
      modo: "livre",
      tempoMedioMin: {},
    })
  ).corpo.id as string;

// Sessão precisa de estação que chame (revisão 2026-11-13).
const estacaoEm = async (cookie: string, unidadeId: string, servicoId: string) =>
  (
    await pedir("POST", `/v1/painel/unidades/${unidadeId}/estacoes`, cookie, {
      nome: "C1",
      etapa: "atendimento",
      servicos: [servicoId],
    })
  ).corpo.id as string;

describe("DELETE /v1/painel/unidades/:id", () => {
  it("SMS remove unidade sem uso: some da lista e a equipe perde a atribuição nela", async () => {
    const id = await novaUnidade("UBS Vazia");
    const enf = await usuarioLogado(slug, gestor, "enfvazia", ocupacao(id, "enfermeiro"));
    expect((await pedir("DELETE", `/v1/painel/unidades/${id}`, gestor)).status).toBe(204);
    const lista = (await pedir("GET", "/v1/painel/unidades", gestor)).corpo.map((u: { id: string }) => u.id);
    expect(lista).not.toContain(id);
    expect((await pedir("GET", `/v1/painel/unidades/${id}`, gestor)).status).toBe(404);
    expect((await pedir("GET", "/v1/painel/eu", enf.cookie)).corpo.vinculos).toEqual([]);
  });

  it("gerente não remove unidade → 403", async () => {
    const id = await novaUnidade("UBS do Gerente");
    const g = await usuarioLogado(slug, gestor, "gerrem", gerente(id));
    expect((await pedir("DELETE", `/v1/painel/unidades/${id}`, g.cookie)).status).toBe(403);
  });

  it("com sessão planejada → 409 unidade_com_sessoes", async () => {
    const id = await novaUnidade("UBS com Sessão");
    const g = await usuarioLogado(slug, gestor, "gersess", gerente(id));
    const servicoId = await servicoEm(g.cookie, id);
    await pedir("POST", `/v1/painel/unidades/${id}/sessoes`, g.cookie, {
      servicoId,
      inicio: "2026-12-01T11:00:00.000Z",
      fim: "2026-12-01T15:00:00.000Z",
      vagas: null,
      visibilidade: "privada",
      dispensaPreCadastro: false,
      profissional: null,
      estacoes: [await estacaoEm(g.cookie, id, servicoId)],
    });
    expect(await pedir("DELETE", `/v1/painel/unidades/${id}`, gestor)).toMatchObject({
      status: 409,
      corpo: { erro: "unidade_com_sessoes" },
    });
  });

  it("com paciente na lista de espera → 409 unidade_com_entradas", async () => {
    const id = await novaUnidade("UBS com Lista");
    const g = await usuarioLogado(slug, gestor, "gerlista", gerente(id));
    const servicoId = await servicoEm(g.cookie, id);
    const r = await entrarNaLista(orchestrator.bancoDoMunicipio(slug), {
      servicoId,
      pessoa: { nome: "Ana", nascimento: "1990-01-01", cpf: null, pacienteId: null },
      responsavelPacienteId: null,
      respostas: { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] },
      agora: Date.now(),
    });
    expect(r.ok).toBe(true);
    expect(await pedir("DELETE", `/v1/painel/unidades/${id}`, gestor)).toMatchObject({
      status: 409,
      corpo: { erro: "unidade_com_entradas", dados: { entradasAtivas: 1 } },
    });
    expect(entrada).toBeDefined();
  });
});
