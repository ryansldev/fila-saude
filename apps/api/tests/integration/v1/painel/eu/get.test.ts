import { funcaoUsuario } from "infra/database/municipal/schema/equipe";
import orchestrator from "tests/orchestrator";
import { gerente } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;
let b: string;
let unidadeId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug: a } = await orchestrator.criarMunicipio());
  ({ slug: b } = await orchestrator.criarMunicipio());
  unidadeId = await orchestrator.criarUnidadeDireto(a);
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("GET /v1/painel/eu", () => {
  it("T1.9: eu devolve os perfis com escopo", async () => {
    const cookie = await orchestrator.loginGestor(a);
    const r = await orchestrator.pedirPainel(a, "GET", "/v1/painel/eu", { cookie });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({
      login: "gestor",
      funcoes: [{ funcao: "gestao_sms", unidadeId: null }],
      perfis: [{ perfil: "gestao_sms", unidadeId: null }],
    });
  });

  it("RN-PERF-01: enfermeira que também agenda tem os dois papéis", async () => {
    const u = await orchestrator.criarUsuarioComPerfis(a, "dupla", {
      vinculos: [{ unidadeId, ocupacao: "enfermeiro" }],
      funcoes: [{ funcao: "agendar", unidadeId }],
    });
    const cookie = await orchestrator.loginPainel(a, u.login, u.senha);
    const r = await orchestrator.pedirPainel(a, "GET", "/v1/painel/eu", { cookie });
    expect(r.corpo.perfis).toHaveLength(2);
    expect(r.corpo.perfis.map((p: { perfil: string }) => p.perfil).sort()).toEqual(["agendar", "enfermeiro"]);
  });

  it("sem sessão → 401; cookie do paciente da central → 401", async () => {
    expect((await orchestrator.pedirPainel(a, "GET", "/v1/painel/eu")).status).toBe(401);
    const { cookie } = await orchestrator.loginPaciente();
    expect((await orchestrator.pedirPainel(a, "GET", "/v1/painel/eu", { cookie })).status).toBe(401);
  });

  it("modelo: SMS com unidade e gerente sem unidade recusados pelo banco", async () => {
    const db = orchestrator.bancoDoMunicipio(a);
    const u = await orchestrator.criarUsuarioComPerfis(a, "escopo", gerente(unidadeId));
    await expect(
      db.insert(funcaoUsuario).values({ usuarioId: u.id, funcao: "gestao_sms", unidadeId }),
    ).rejects.toThrow();
    await expect(
      db.insert(funcaoUsuario).values({ usuarioId: u.id, funcao: "gerente_ubs", unidadeId: null }),
    ).rejects.toThrow();
  });

  it("perfil de A não aparece no eu de B", async () => {
    const cookieB = await orchestrator.loginGestor(b);
    const r = await orchestrator.pedirPainel(b, "GET", "/v1/painel/eu", { cookie: cookieB });
    expect(r.corpo.perfis).toEqual([{ perfil: "gestao_sms", unidadeId: null }]);
  });
});
