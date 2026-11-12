import { eq } from "drizzle-orm";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import orchestrator from "tests/orchestrator";
import { municipioComUnidade, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let gestor: string;
let unidadeId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, gestor, unidadeId } = await municipioComUnidade());
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
const novo = (login: string, perfis: unknown) => ({ login, nome: login, senha: "senha-forte-1", perfis });

describe("usuários do painel", () => {
  it("T2.2: gestor cria recepção da unidade e ela loga e vê o perfil no eu", async () => {
    const r = await usuarioLogado(slug, gestor, "recep", [{ perfil: "recepcao", unidadeId }]);
    const eu = await pedir("GET", "/v1/painel/eu", r.cookie);
    expect(eu.corpo.perfis).toEqual([{ perfil: "recepcao", unidadeId }]);
    const lista = await pedir("GET", "/v1/painel/usuarios", gestor);
    expect(lista.corpo.map((u: { login: string }) => u.login)).toEqual(expect.arrayContaining(["gestor", "recep"]));
  });

  it("perfil de unidade sem unidade ou com unidade inexistente → 400; gestor com unidade → 400", async () => {
    expect(
      (await pedir("POST", "/v1/painel/usuarios", gestor, novo("semu", [{ perfil: "admin", unidadeId: null }]))).status,
    ).toBe(400);
    const inexistente = crypto.randomUUID();
    expect(
      (await pedir("POST", "/v1/painel/usuarios", gestor, novo("inex", [{ perfil: "admin", unidadeId: inexistente }])))
        .status,
    ).toBe(400);
    expect(
      (await pedir("POST", "/v1/painel/usuarios", gestor, novo("gu", [{ perfil: "gestor", unidadeId }]))).status,
    ).toBe(400);
  });

  it("login repetido → 409; só o gestor gerencia usuários", async () => {
    const dup = await pedir("POST", "/v1/painel/usuarios", gestor, novo("recep", [{ perfil: "triagem", unidadeId }]));
    expect(dup).toMatchObject({ status: 409, corpo: { erro: "login_em_uso" } });
    const admin = await usuarioLogado(slug, gestor, "adm", [{ perfil: "admin", unidadeId }]);
    expect(
      (await pedir("POST", "/v1/painel/usuarios", admin.cookie, novo("x1x", [{ perfil: "triagem", unidadeId }])))
        .status,
    ).toBe(403);
    expect((await pedir("GET", "/v1/painel/usuarios", admin.cookie)).status).toBe(403);
  });

  it("último gestor não perde o perfil; com dois, um pode sair; troca auditada", async () => {
    const eu = (await pedir("GET", "/v1/painel/eu", gestor)).corpo;
    const ultimo = await pedir("PUT", `/v1/painel/usuarios/${eu.id}/perfis`, gestor, {
      perfis: [{ perfil: "admin", unidadeId }],
    });
    expect(ultimo).toMatchObject({ status: 409, corpo: { erro: "ultimo_gestor" } });
    const outro = await usuarioLogado(slug, gestor, "gestor2", [{ perfil: "gestor", unidadeId: null }]);
    const troca = await pedir("PUT", `/v1/painel/usuarios/${outro.id}/perfis`, gestor, {
      perfis: [{ perfil: "admin", unidadeId }],
    });
    expect(troca).toMatchObject({ status: 200, corpo: { perfis: [{ perfil: "admin", unidadeId }] } });
    const linhas = await orchestrator
      .bancoDoMunicipio(slug)
      .select()
      .from(auditoria)
      .where(eq(auditoria.alvoId, outro.id));
    expect(linhas).toHaveLength(2);
  });
});
