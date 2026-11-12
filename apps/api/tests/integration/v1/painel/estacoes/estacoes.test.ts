import { eq } from "drizzle-orm";
import { estacao } from "infra/database/municipal/schema/estacao";
import orchestrator from "tests/orchestrator";
import { municipioComUnidade, UNIDADE, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let gestor: string;
let unidadeId: string;
let admin: string;
let comTriagem: string;
let semTriagem: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, gestor, unidadeId } = await municipioComUnidade());
  admin = (await usuarioLogado(slug, gestor, "admin", [{ perfil: "admin", unidadeId }])).cookie;
  const s = (corpo: object) => pedir("POST", `/v1/painel/unidades/${unidadeId}/servicos`, admin, corpo);
  comTriagem = (await s({ nome: "Clínico", prefixo: "C", exigeTriagem: true, modo: "livre", tempoMedioMin: {} })).corpo
    .id;
  semTriagem = (await s({ nome: "Odonto", prefixo: "O", exigeTriagem: false, modo: "livre", tempoMedioMin: {} })).corpo
    .id;
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
const criar = (corpo: unknown) => pedir("POST", `/v1/painel/unidades/${unidadeId}/estacoes`, admin, corpo);

describe("estações", () => {
  it("RN-EST-01 / RN-TRI-02: estação ligada a etapa e serviços", async () => {
    const r = await criar({ nome: "Consultório 1", etapa: "atendimento", servicos: [comTriagem, semTriagem] });
    expect(r).toMatchObject({ status: 201, corpo: { etapa: "atendimento", aberta: false } });
    expect(r.corpo.servicos.sort()).toEqual([comTriagem, semTriagem].sort());
    expect((await criar({ nome: "Triagem 1", etapa: "triagem", servicos: [comTriagem] })).status).toBe(201);
  });

  it("triagem com serviço sem triagem → 400; serviço de outra unidade → 400", async () => {
    expect((await criar({ nome: "T2", etapa: "triagem", servicos: [semTriagem] })).status).toBe(400);
    const u2 = await pedir("POST", "/v1/painel/unidades", gestor, { ...UNIDADE, nome: "UBS 2" });
    const adm2 = (await usuarioLogado(slug, gestor, "adm2", [{ perfil: "admin", unidadeId: u2.corpo.id }])).cookie;
    const fora = (
      await pedir("POST", `/v1/painel/unidades/${u2.corpo.id}/servicos`, adm2, {
        nome: "X",
        prefixo: "X",
        exigeTriagem: false,
        modo: "livre",
        tempoMedioMin: {},
      })
    ).corpo.id;
    expect((await criar({ nome: "C9", etapa: "atendimento", servicos: [fora] })).status).toBe(400);
  });

  it("edita nome e serviços; estação aberta não é arquivada; fechada some da lista", async () => {
    const e = (await criar({ nome: "C3", etapa: "atendimento", servicos: [semTriagem] })).corpo;
    expect((await pedir("PATCH", `/v1/painel/estacoes/${e.id}`, admin, { nome: "Consultório 3" })).corpo.nome).toBe(
      "Consultório 3",
    );
    await orchestrator.bancoDoMunicipio(slug).update(estacao).set({ aberta: true }).where(eq(estacao.id, e.id));
    expect(await pedir("DELETE", `/v1/painel/estacoes/${e.id}`, admin)).toMatchObject({
      status: 409,
      corpo: { erro: "estacao_ocupada" },
    });
    await orchestrator.bancoDoMunicipio(slug).update(estacao).set({ aberta: false }).where(eq(estacao.id, e.id));
    expect((await pedir("DELETE", `/v1/painel/estacoes/${e.id}`, admin)).status).toBe(204);
    const lista = await pedir("GET", `/v1/painel/unidades/${unidadeId}/estacoes`, admin);
    expect(lista.corpo.map((x: { id: string }) => x.id)).not.toContain(e.id);
  });
});
