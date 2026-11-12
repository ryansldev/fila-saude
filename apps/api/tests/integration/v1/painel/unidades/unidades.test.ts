import { eq } from "drizzle-orm";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import orchestrator from "tests/orchestrator";
import { municipioComUnidade, UNIDADE, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let gestor: string;
let unidadeId: string;
let outroSlug: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, gestor, unidadeId } = await municipioComUnidade());
  ({ slug: outroSlug } = await orchestrator.criarMunicipio());
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });

describe("unidades", () => {
  it("T2.2: gestor cria unidade e ela aparece na lista; unidade de A não aparece em B", async () => {
    const lista = await pedir("GET", "/v1/painel/unidades", gestor);
    expect(lista.status).toBe(200);
    expect(lista.corpo.map((u: { id: string }) => u.id)).toContain(unidadeId);
    const gestorB = await orchestrator.loginGestor(outroSlug);
    const deB = await orchestrator.pedirPainel(outroSlug, "GET", "/v1/painel/unidades", { cookie: gestorB });
    expect(deB.corpo).toEqual([]);
  });

  it("T2.2: só o gestor cria ou edita; admin da unidade 1 lista só a unidade 1", async () => {
    const u2 = await pedir("POST", "/v1/painel/unidades", gestor, { ...UNIDADE, nome: "UBS 2" });
    const admin = await usuarioLogado(slug, gestor, "admin1", [{ perfil: "admin", unidadeId }]);
    expect((await pedir("POST", "/v1/painel/unidades", admin.cookie, UNIDADE)).status).toBe(403);
    expect((await pedir("PATCH", `/v1/painel/unidades/${unidadeId}`, admin.cookie, { nome: "X" })).status).toBe(403);
    const lista = await pedir("GET", "/v1/painel/unidades", admin.cookie);
    expect(lista.corpo.map((u: { id: string }) => u.id)).toEqual([unidadeId]);
    expect(u2.status).toBe(201);
  });

  it("fuso inválido → 400; K 0 → 400 no campo; K 1 aceito", async () => {
    const fuso = await pedir("POST", "/v1/painel/unidades", gestor, { ...UNIDADE, fuso: "Brasil/Lua" });
    expect(fuso).toMatchObject({ status: 400, corpo: { erro: "entrada_invalida" } });
    expect(fuso.corpo.campos.fuso).toBeDefined();
    const k0 = await pedir("PATCH", `/v1/painel/unidades/${unidadeId}`, gestor, { config: { janelaK: 0 } });
    expect(k0.status).toBe(400);
    expect(k0.corpo.campos["config.janelaK"]).toBeDefined();
    const k1 = await pedir("PATCH", `/v1/painel/unidades/${unidadeId}`, gestor, { config: { janelaK: 1 } });
    expect(k1).toMatchObject({ status: 200, corpo: { config: { janelaK: 1 } } });
  });

  it("modelo: sem valor herda o padrão; com valor, origem unidade; null volta a herdar", async () => {
    await pedir("PATCH", `/v1/painel/unidades/${unidadeId}`, gestor, { config: { toleranciaMin: 7 } });
    let cfg = await pedir("GET", `/v1/painel/unidades/${unidadeId}/config`, gestor);
    expect(cfg.corpo.origem.toleranciaMin).toBe("unidade");
    expect(cfg.corpo.valores.toleranciaMin).toBe(7);
    expect(cfg.corpo.origem.qrSegundos).toBe("padrao");
    await pedir("PATCH", `/v1/painel/unidades/${unidadeId}`, gestor, { config: { toleranciaMin: null } });
    cfg = await pedir("GET", `/v1/painel/unidades/${unidadeId}/config`, gestor);
    expect(cfg.corpo.origem.toleranciaMin).toBe("padrao");
  });

  it("INV-12: criar e editar auditados em nome do gestor", async () => {
    const linhas = await orchestrator
      .bancoDoMunicipio(slug)
      .select()
      .from(auditoria)
      .where(eq(auditoria.alvoId, unidadeId));
    expect(linhas.length).toBeGreaterThanOrEqual(2);
    expect(new Set(linhas.map((l) => l.acao))).toEqual(new Set(["criar_unidades_regras_usuarios"]));
  });
});
