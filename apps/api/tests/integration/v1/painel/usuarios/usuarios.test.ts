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

const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
  orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
const novo = (login: string, atribuicoes: object) => ({ login, nome: login, senha: "senha-forte-1", ...atribuicoes });

describe("equipe do painel", () => {
  it("T2.2: SMS cria recepção da unidade; ela loga e o eu mostra ocupação e papel", async () => {
    const r = await usuarioLogado(slug, gestor, "recep", ocupacao(unidadeId, "recepcao"));
    const eu = await pedir("GET", "/v1/painel/eu", r.cookie);
    expect(eu.corpo).toMatchObject({
      vinculos: [{ unidadeId, ocupacao: "recepcao" }],
      funcoes: [],
      perfis: [{ perfil: "recepcao", unidadeId }],
    });
  });

  it("escopo: função da unidade sem unidade, unidade inexistente e SMS com unidade → 400", async () => {
    const semUnidade = { vinculos: [], funcoes: [{ funcao: "gerente_ubs", unidadeId: null }] };
    expect((await pedir("POST", "/v1/painel/usuarios", gestor, novo("semu", semUnidade))).status).toBe(400);
    expect(
      (await pedir("POST", "/v1/painel/usuarios", gestor, novo("inex", gerente(crypto.randomUUID())))).status,
    ).toBe(400);
    const smsComUnidade = { vinculos: [], funcoes: [{ funcao: "gestao_sms", unidadeId }] };
    expect((await pedir("POST", "/v1/painel/usuarios", gestor, novo("smsu", smsComUnidade))).status).toBe(400);
    expect(
      (await pedir("POST", "/v1/painel/usuarios", gestor, novo("vazio", { vinculos: [], funcoes: [] }))).status,
    ).toBe(400);
  });

  it("RN-PERF-04: gerente cadastra a equipe da própria UBS, com a permissão agendar", async () => {
    const r = await pedir(
      "POST",
      "/v1/painel/usuarios",
      gerenteCookie,
      novo("tecnica", ocupacao(unidadeId, "tecnico_enfermagem", "agendar")),
    );
    expect(r.status).toBe(201);
    expect(r.corpo.funcoes).toEqual([{ funcao: "agendar", unidadeId }]);
  });

  it("RN-PERF-04: gerente não cadastra em outra UBS nem dá função de gestão", async () => {
    expect(
      (await pedir("POST", "/v1/painel/usuarios", gerenteCookie, novo("fora", ocupacao(outraId, "medico")))).status,
    ).toBe(403);
    expect((await pedir("POST", "/v1/painel/usuarios", gerenteCookie, novo("ger2", gerente(unidadeId)))).status).toBe(
      403,
    );
    expect((await pedir("POST", "/v1/painel/usuarios", gerenteCookie, novo("sms2", sms()))).status).toBe(403);
  });

  it("RN-PERF-04: quem não é SMS nem gerente não cadastra nem lista; gerente lista só a sua UBS", async () => {
    const enf = await usuarioLogado(slug, gestor, "enf", ocupacao(unidadeId, "enfermeiro"));
    expect(
      (await pedir("POST", "/v1/painel/usuarios", enf.cookie, novo("x1x", ocupacao(unidadeId, "acs")))).status,
    ).toBe(403);
    expect((await pedir("GET", "/v1/painel/usuarios", enf.cookie)).status).toBe(403);
    await usuarioLogado(slug, gestor, "norte", ocupacao(outraId, "medico"));
    const lista = (await pedir("GET", "/v1/painel/usuarios", gerenteCookie)).corpo.map(
      (u: { login: string }) => u.login,
    );
    expect(lista).toContain("enf");
    expect(lista).not.toContain("norte");
    expect(lista).not.toContain("gestor");
  });

  it("RN-PERF-04: gerente não mexe em quem tem atribuição fora da UBS dele", async () => {
    const dupla = await usuarioLogado(slug, gestor, "dupla", {
      vinculos: [
        { unidadeId, ocupacao: "medico" },
        { unidadeId: outraId, ocupacao: "medico" },
      ],
      funcoes: [],
    });
    const r = await pedir(
      "PUT",
      `/v1/painel/usuarios/${dupla.id}/atribuicoes`,
      gerenteCookie,
      ocupacao(unidadeId, "medico"),
    );
    expect(r.status).toBe(403);
  });

  it("login repetido → 409; último SMS não perde a função; com dois, um pode sair; troca auditada", async () => {
    const dup = await pedir("POST", "/v1/painel/usuarios", gestor, novo("recep", ocupacao(unidadeId, "enfermeiro")));
    expect(dup).toMatchObject({ status: 409, corpo: { erro: "login_em_uso" } });
    const eu = (await pedir("GET", "/v1/painel/eu", gestor)).corpo;
    const ultimo = await pedir("PUT", `/v1/painel/usuarios/${eu.id}/atribuicoes`, gestor, gerente(unidadeId));
    expect(ultimo).toMatchObject({ status: 409, corpo: { erro: "ultimo_gestor" } });
    const outro = await usuarioLogado(slug, gestor, "gestor2", sms());
    const troca = await pedir("PUT", `/v1/painel/usuarios/${outro.id}/atribuicoes`, gestor, gerente(unidadeId));
    expect(troca).toMatchObject({ status: 200, corpo: { funcoes: [{ funcao: "gerente_ubs", unidadeId }] } });
    const linhas = await orchestrator
      .bancoDoMunicipio(slug)
      .select()
      .from(auditoria)
      .where(eq(auditoria.alvoId, outro.id));
    expect(linhas).toHaveLength(2);
  });
});
