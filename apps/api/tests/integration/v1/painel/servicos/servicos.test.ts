import { eq } from "drizzle-orm";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import { sessao } from "infra/database/municipal/schema/sessao";
import orchestrator from "tests/orchestrator";
import { municipioComUnidade, UNIDADE, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let gestor: string;
let unidadeId: string;
let admin: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, gestor, unidadeId } = await municipioComUnidade());
  admin = (await usuarioLogado(slug, gestor, "admin", [{ perfil: "admin", unidadeId }])).cookie;
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
const servico = (prefixo: string, extra: object = {}) => ({
  nome: `Serviço ${prefixo}`,
  prefixo,
  exigeTriagem: false,
  modo: "livre",
  tempoMedioMin: {},
  ...extra,
});
const criar = (corpo: unknown, cookie = admin, u = unidadeId) =>
  pedir("POST", `/v1/painel/unidades/${u}/servicos`, cookie, corpo);

describe("serviços", () => {
  it("T2.3: admin cria serviço com triagem e tempos; padrões livre, 15 min", async () => {
    const r = await criar(servico("C", { exigeTriagem: true, tempoMedioMin: { triagem: 5, atendimento: 20 } }));
    expect(r).toMatchObject({
      status: 201,
      corpo: { prefixo: "C", exigeTriagem: true, tempoMedioMin: { triagem: 5, atendimento: 20 } },
    });
    const p = await criar(servico("P"));
    expect(p.corpo).toMatchObject({ modo: "livre", tempoMedioMin: { atendimento: 15 } });
    const lista = await pedir("GET", `/v1/painel/unidades/${unidadeId}/servicos`, admin);
    expect(lista.corpo).toHaveLength(2);
  });

  it("prefixo repetido na unidade → 409; em outra unidade, aceito", async () => {
    expect(await criar(servico("C"))).toMatchObject({ status: 409, corpo: { erro: "prefixo_em_uso" } });
    const u2 = await pedir("POST", "/v1/painel/unidades", gestor, { ...UNIDADE, nome: "UBS 2" });
    const admin2 = (await usuarioLogado(slug, gestor, "admin2", [{ perfil: "admin", unidadeId: u2.corpo.id }])).cookie;
    expect((await criar(servico("C"), admin2, u2.corpo.id)).status).toBe(201);
    const s1 = (await pedir("GET", `/v1/painel/unidades/${unidadeId}/servicos`, admin)).corpo[0];
    expect((await pedir("PATCH", `/v1/painel/servicos/${s1.id}`, admin2, { nome: "invasão" })).status).toBe(403);
  });

  it("RN-TRI-01: exige triagem muda com sessão planejada; com sessão aberta → 409 sessao_aberta", async () => {
    const s = (await criar(servico("T"))).corpo;
    const db = orchestrator.bancoDoMunicipio(slug);
    const [x] = await db
      .insert(sessao)
      .values({ servicoId: s.id, inicio: new Date(Date.now() + 864e5), fim: new Date(Date.now() + 9e7) })
      .returning();
    expect((await pedir("PATCH", `/v1/painel/servicos/${s.id}`, admin, { exigeTriagem: true })).status).toBe(200);
    await db
      .update(sessao)
      .set({ estado: "aberta" })
      .where(eq(sessao.id, x?.id as string));
    expect(await pedir("PATCH", `/v1/painel/servicos/${s.id}`, admin, { exigeTriagem: false })).toMatchObject({
      status: 409,
      corpo: { erro: "sessao_aberta" },
    });
  });

  it("desligar triagem com estação de triagem ligada → 409", async () => {
    const s = (await criar(servico("E", { exigeTriagem: true }))).corpo;
    await pedir("POST", `/v1/painel/unidades/${unidadeId}/estacoes`, admin, {
      nome: "T1",
      etapa: "triagem",
      servicos: [s.id],
    });
    expect(await pedir("PATCH", `/v1/painel/servicos/${s.id}`, admin, { exigeTriagem: false })).toMatchObject({
      status: 409,
      corpo: { erro: "servico_em_estacao_de_triagem" },
    });
  });

  it("PD-42: modo com entradas ativas → 409 com a contagem; sem entradas, muda", async () => {
    const s = (await criar(servico("M"))).corpo;
    expect((await pedir("PATCH", `/v1/painel/servicos/${s.id}`, admin, { modo: "requisicao" })).status).toBe(200);
    const { entrarNaLista } = await import("infra/fila/entradas");
    await pedir("PATCH", `/v1/painel/servicos/${s.id}`, admin, { modo: "livre" });
    await entrarNaLista(orchestrator.bancoDoMunicipio(slug), {
      servicoId: s.id,
      pessoa: { nome: "Ana", nascimento: "1990-01-01", cpf: null, pacienteId: null },
      responsavelPacienteId: null,
      respostas: { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] },
      agora: Date.now(),
    });
    expect(await pedir("PATCH", `/v1/painel/servicos/${s.id}`, admin, { modo: "regulado" })).toMatchObject({
      status: 409,
      corpo: { erro: "servico_com_entradas", dados: { entradasAtivas: 1 } },
    });
  });

  it("recepção não configura → 403; INV-12: auditoria", async () => {
    const recep = (await usuarioLogado(slug, gestor, "recep", [{ perfil: "recepcao", unidadeId }])).cookie;
    expect((await criar(servico("R"), recep)).status).toBe(403);
    const linhas = await orchestrator
      .bancoDoMunicipio(slug)
      .select()
      .from(auditoria)
      .where(eq(auditoria.alvoTipo, "servico"));
    expect(linhas.length).toBeGreaterThan(0);
  });
});
