import { eq } from "drizzle-orm";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import orchestrator from "tests/orchestrator";
import { gerente, municipioComUnidade, ocupacao, sms, UNIDADE, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let gestor: string;
let unidadeId: string;
let outraId: string;
let gerenteCookie: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, gestor, unidadeId } = await municipioComUnidade());
  outraId = (
    await orchestrator.pedirPainel(slug, "POST", "/v1/painel/unidades", {
      cookie: gestor,
      corpo: { ...UNIDADE, nome: "UBS Norte" },
    })
  ).corpo.id;
  gerenteCookie = (await usuarioLogado(slug, gestor, "gerente", gerente(unidadeId))).cookie;
});
afterAll(() => orchestrator.derrubarMunicipios());

const pedir = (m: string, c: string, cookie: string) => orchestrator.pedirPainel(slug, m, c, { cookie });

describe("DELETE /v1/painel/usuarios/:id", () => {
  it("gerente remove alguém da equipe: a pessoa sai da lista, a sessão dela cai e o login não entra mais", async () => {
    const tec = await usuarioLogado(slug, gestor, "tecrem", ocupacao(unidadeId, "tecnico_enfermagem"));
    expect((await pedir("DELETE", `/v1/painel/usuarios/${tec.id}`, gerenteCookie)).status).toBe(204);
    const lista = (await pedir("GET", "/v1/painel/usuarios", gestor)).corpo.map((u: { id: string }) => u.id);
    expect(lista).not.toContain(tec.id);
    expect((await pedir("GET", "/v1/painel/eu", tec.cookie)).status).toBe(401);
    await expect(orchestrator.loginPainel(slug, "tecrem", "senha-forte-1")).rejects.toThrow(/401/);
    const linhas = await orchestrator
      .bancoDoMunicipio(slug)
      .select()
      .from(auditoria)
      .where(eq(auditoria.alvoId, tec.id));
    expect(linhas.map((l) => l.dados?.removido ?? null)).toContain(true);
  });

  it("RN-PERF-04: gerente não remove quem é de outra UBS nem a SMS; enfermeira não remove ninguém", async () => {
    const norte = await usuarioLogado(slug, gestor, "norterem", ocupacao(outraId, "medico"));
    expect((await pedir("DELETE", `/v1/painel/usuarios/${norte.id}`, gerenteCookie)).status).toBe(403);
    const enf = await usuarioLogado(slug, gestor, "enfrem", ocupacao(unidadeId, "enfermeiro"));
    const acs = await usuarioLogado(slug, gestor, "acsrem", ocupacao(unidadeId, "acs"));
    expect((await pedir("DELETE", `/v1/painel/usuarios/${acs.id}`, enf.cookie)).status).toBe(403);
  });

  it("ninguém remove a si mesmo; com dois gestores da SMS, um remove o outro", async () => {
    const eu = (await pedir("GET", "/v1/painel/eu", gestor)).corpo;
    expect(await pedir("DELETE", `/v1/painel/usuarios/${eu.id}`, gestor)).toMatchObject({
      status: 409,
      corpo: { erro: "remover_a_si_mesmo" },
    });
    const outro = await usuarioLogado(slug, gestor, "sms2rem", sms());
    expect(await pedir("DELETE", `/v1/painel/usuarios/${outro.id}`, gerenteCookie)).toMatchObject({ status: 403 });
    expect(await pedir("DELETE", `/v1/painel/usuarios/${outro.id}`, gestor)).toMatchObject({ status: 204 });
  });

  it("login de quem foi removido pode ser cadastrado de novo? não: continua em uso", async () => {
    const x = await usuarioLogado(slug, gestor, "reuso", ocupacao(unidadeId, "acs"));
    await pedir("DELETE", `/v1/painel/usuarios/${x.id}`, gerenteCookie);
    const r = await orchestrator.pedirPainel(slug, "POST", "/v1/painel/usuarios", {
      cookie: gerenteCookie,
      corpo: { login: "reuso", nome: "Reuso", senha: "senha-forte-1", ...ocupacao(unidadeId, "acs") },
    });
    expect(r).toMatchObject({ status: 409, corpo: { erro: "login_em_uso" } });
  });
});
