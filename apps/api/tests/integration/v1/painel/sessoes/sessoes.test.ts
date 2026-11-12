import { eq } from "drizzle-orm";
import { sessao } from "infra/database/municipal/schema/sessao";
import orchestrator from "tests/orchestrator";
import { gerente, municipioComUnidade, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let unidadeId: string;
let admin: string;
let servicoId: string;
let reguladoId: string;
let estacaoId: string;
let estacaoOutra: string;

const respostas = { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] } as const;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  let gestor: string;
  ({ slug, gestor, unidadeId } = await municipioComUnidade());
  admin = (await usuarioLogado(slug, gestor, "admin", gerente(unidadeId))).cookie;
  const s = (corpo: object) =>
    pedir("POST", `/v1/painel/unidades/${unidadeId}/servicos`, admin, {
      exigeTriagem: false,
      modo: "livre",
      tempoMedioMin: {},
      ...corpo,
    });
  servicoId = (await s({ nome: "Odonto", prefixo: "O" })).corpo.id;
  reguladoId = (await s({ nome: "Cardio", prefixo: "K", modo: "regulado" })).corpo.id;
  const e = (nome: string, servicos: string[]) =>
    pedir("POST", `/v1/painel/unidades/${unidadeId}/estacoes`, admin, { nome, etapa: "atendimento", servicos });
  estacaoId = (await e("C1", [servicoId])).corpo.id;
  estacaoOutra = (await e("C2", [reguladoId])).corpo.id;
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
const base = (extra: object = {}) => ({
  servicoId,
  inicio: "2026-12-01T11:00:00.000Z",
  fim: "2026-12-01T15:00:00.000Z",
  vagas: 20,
  visibilidade: "publica",
  dispensaPreCadastro: false,
  profissional: "Dra. Helena",
  estacoes: [estacaoId],
  ...extra,
});
const criar = (corpo: unknown) => pedir("POST", `/v1/painel/unidades/${unidadeId}/sessoes`, admin, corpo);

describe("sessões avulsas", () => {
  it("T2.5: admin cria sessão avulsa pública com vagas e estações; lista por intervalo", async () => {
    const r = await criar(base());
    expect(r).toMatchObject({
      status: 201,
      corpo: { estado: "planejada", vagas: 20, ocupadas: 0, versao: 0, estacoes: [estacaoId] },
    });
    const lista = await pedir(
      "GET",
      `/v1/painel/unidades/${unidadeId}/sessoes?de=2026-12-01T00:00:00Z&ate=2026-12-02T00:00:00Z`,
      admin,
    );
    expect(lista.corpo.map((s: { id: string }) => s.id)).toContain(r.corpo.id);
    const vazia = await pedir(
      "GET",
      `/v1/painel/unidades/${unidadeId}/sessoes?de=2026-12-02T00:00:00Z&ate=2026-12-03T00:00:00Z`,
      admin,
    );
    expect(vazia.corpo).toEqual([]);
  });

  it("vagas 0 → 400; 1 aceito; AD-016 dispensa em privada → 400; estação que não atende → 400", async () => {
    expect((await criar(base({ vagas: 0 }))).status).toBe(400);
    expect((await criar(base({ vagas: 1 }))).status).toBe(201);
    expect((await criar(base({ visibilidade: "privada", dispensaPreCadastro: true }))).status).toBe(400);
    expect((await criar(base({ estacoes: [estacaoOutra] }))).status).toBe(400);
  });

  it("pública em serviço regulado → 409 servico_regulado", async () => {
    expect(await criar(base({ servicoId: reguladoId, estacoes: [] }))).toMatchObject({
      status: 409,
      corpo: { erro: "servico_regulado" },
    });
  });

  it("vagas = ocupadas aceito; ocupadas − 1 → 409; versao velha → 409; aberta não muda horário", async () => {
    const s = (await criar(base())).corpo;
    const db = orchestrator.bancoDoMunicipio(slug);
    await db.update(sessao).set({ ocupadas: 5 }).where(eq(sessao.id, s.id));
    const ok = await pedir("PATCH", `/v1/painel/sessoes/${s.id}`, admin, { vagas: 5, versao: 0 });
    expect(ok).toMatchObject({ status: 200, corpo: { vagas: 5, versao: 1 } });
    expect(await pedir("PATCH", `/v1/painel/sessoes/${s.id}`, admin, { vagas: 4, versao: 1 })).toMatchObject({
      status: 409,
      corpo: { erro: "vagas_abaixo_das_ocupadas" },
    });
    expect(await pedir("PATCH", `/v1/painel/sessoes/${s.id}`, admin, { vagas: 9, versao: 0 })).toMatchObject({
      status: 409,
      corpo: { erro: "versao_desatualizada" },
    });
    await db.update(sessao).set({ estado: "aberta" }).where(eq(sessao.id, s.id));
    expect(
      await pedir("PATCH", `/v1/painel/sessoes/${s.id}`, admin, { inicio: "2026-12-01T12:00:00.000Z", versao: 1 }),
    ).toMatchObject({ status: 409, corpo: { erro: "transicao_proibida" } });
  });

  it("RN-PUB-03: pública vira privada e perde a dispensa", async () => {
    const s = (await criar(base({ dispensaPreCadastro: true }))).corpo;
    const r = await pedir("POST", `/v1/painel/sessoes/${s.id}/visibilidade`, admin, {
      visibilidade: "privada",
      versao: 0,
    });
    expect(r).toMatchObject({ status: 200, corpo: { visibilidade: "privada", dispensaPreCadastro: false } });
  });

  it("cancelar planejada vazia; com entrada → 409 sessao_com_pacientes", async () => {
    const vazia = (await criar(base())).corpo;
    expect(await pedir("POST", `/v1/painel/sessoes/${vazia.id}/cancelar`, admin, {})).toMatchObject({
      status: 200,
      corpo: { estado: "cancelada" },
    });
    const cheia = (await criar(base())).corpo;
    const { entrarNaLista } = await import("infra/fila/entradas");
    const { entrada } = await import("infra/database/municipal/schema/entrada");
    const r = await entrarNaLista(orchestrator.bancoDoMunicipio(slug), {
      servicoId,
      pessoa: { nome: "Bia", nascimento: "1990-01-01", cpf: null, pacienteId: null },
      responsavelPacienteId: null,
      respostas: { ...respostas, alarmes: [], condicoes: [], grupos: [] },
      agora: Date.now(),
    });
    if (!r.ok) throw new Error(r.erro);
    await orchestrator
      .bancoDoMunicipio(slug)
      .update(entrada)
      .set({ sessaoId: cheia.id, estado: "alocada" })
      .where(eq(entrada.id, r.estado.id));
    expect(await pedir("POST", `/v1/painel/sessoes/${cheia.id}/cancelar`, admin, {})).toMatchObject({
      status: 409,
      corpo: { erro: "sessao_com_pacientes" },
    });
  });
});
