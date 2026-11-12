import { eq, inArray, sql } from "drizzle-orm";
import database from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { municipio } from "infra/database/central/schema/municipio";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import { entrada } from "infra/database/municipal/schema/entrada";
import { estacao } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import { unidade } from "infra/database/municipal/schema/unidade";
import env from "infra/env";
import { CPFS_DE_EXEMPLO, type ResumoExemplo, semearExemplo } from "infra/exemplo/semear";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-11-11 23:30 em Brasília: "amanhã" é 12/11 no fuso da unidade, embora já seja 12/11 em UTC.
const AGORA = Date.parse("2026-11-11T23:30:00-03:00");
let slug: string;
let resumo: ResumoExemplo;

const deps = () => ({ central: database, template: env.TENANT_DATABASE_URL_TEMPLATE, agora: AGORA, slug });
const db = () => orchestrator.bancoDoMunicipio(slug);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  slug = orchestrator.slugUnico();
  resumo = await semearExemplo(deps());
}, 60_000);
afterAll(() => orchestrator.derrubarMunicipios());

async function contagens() {
  return {
    unidades: (await db().select().from(unidade)).length,
    servicos: (await db().select().from(servico)).length,
    estacoes: (await db().select().from(estacao)).length,
    sessoes: (await db().select().from(sessao)).length,
    entradas: (await db().select().from(entrada)).length,
  };
}

describe("dev:seed", () => {
  it("exemplo: unidade, dois serviços (um com triagem), três estações e as duas sessões", async () => {
    expect(await contagens()).toEqual({ unidades: 1, servicos: 2, estacoes: 3, sessoes: 2, entradas: 4 });
    const servicos = await db().select().from(servico);
    expect(servicos.filter((s) => s.exigeTriagem)).toHaveLength(1);
  });

  it("exemplo: amanhã é no fuso da unidade", async () => {
    const sessoes = await db().select().from(sessao);
    const publica = sessoes.find((s) => s.visibilidade === "publica");
    const privada = sessoes.find((s) => s.visibilidade === "privada");
    expect(publica?.inicio.toISOString()).toBe("2026-11-12T11:00:00.000Z");
    expect(privada?.inicio.toISOString()).toBe("2026-11-12T16:00:00.000Z");
    expect(resumo.sessoes.map((s) => s.inicioLocal).sort()).toEqual(["2026-11-12T08:00", "2026-11-12T13:00"]);
  });

  it("exemplo: cada perfil loga no painel e o eu mostra o próprio perfil", async () => {
    expect(resumo.usuarios).toHaveLength(6);
    for (const u of resumo.usuarios) {
      const cookie = await orchestrator.loginPainel(slug, u.login, u.senha);
      const eu = await orchestrator.pedirPainel(slug, "GET", "/v1/painel/eu", { cookie });
      expect(eu.corpo.perfis.map((p: { perfil: string }) => p.perfil)).toEqual([u.perfil]);
    }
  });

  it("exemplo: pacientes logam na central e há 4 entradas aguardando na Odontologia", async () => {
    for (const p of resumo.pacientes) {
      const r = await fetch(`${webserver.origin}/v1/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: webserver.origin },
        body: JSON.stringify({ username: p.cpf, password: p.senha }),
      });
      expect(r.status).toBe(200);
    }
    const [odonto] = await db().select().from(servico).where(eq(servico.prefixo, "O"));
    const entradas = await db()
      .select()
      .from(entrada)
      .where(eq(entrada.servicoId, odonto?.id as string));
    expect(entradas.map((e) => e.estado)).toEqual(["aguardando", "aguardando", "aguardando", "aguardando"]);
  });

  it("PD-40: auditoria atribuída a quem fez; nenhuma linha para as entradas dos pacientes", async () => {
    const id = (login: string) => resumo.usuarios.find((u) => u.login === login)?.id;
    const linhas = await db().select().from(auditoria);
    const por = (login: string) =>
      linhas
        .filter((l) => l.usuarioId === id(login))
        .map((l) => l.alvoTipo)
        .sort();
    expect(por("gestor")).toEqual(["unidade", "usuario", "usuario", "usuario", "usuario", "usuario"]);
    expect(por("admin")).toEqual(["estacao", "estacao", "estacao", "servico", "servico", "sessao", "sessao"]);
    expect(por("recepcao")).toEqual(["entrada"]);
    expect(linhas).toHaveLength(14);
  });

  it("PD-40: rodar de novo apaga e recria — mesmas contagens, ids novos, sessão antiga inválida", async () => {
    const cookie = await orchestrator.loginPainel(slug, "gestor", "exemplo123");
    const [antes] = await db().select().from(unidade);
    await orchestrator.bancoDoMunicipio(slug).$client.end();
    orchestrator.esquecerBanco(slug);
    resumo = await semearExemplo(deps());
    const [depois] = await db().select().from(unidade);
    expect(depois?.id).not.toBe(antes?.id);
    expect(await contagens()).toEqual({ unidades: 1, servicos: 2, estacoes: 3, sessoes: 2, entradas: 4 });
    expect((await orchestrator.pedirPainel(slug, "GET", "/v1/painel/eu", { cookie })).status).toBe(401);
    const novo = await orchestrator.loginPainel(slug, "gestor", "exemplo123");
    expect((await orchestrator.pedirPainel(slug, "GET", "/v1/painel/eu", { cookie: novo })).status).toBe(200);
  }, 60_000);

  it("PD-40: depois de uma execução interrompida (município em criando, pacientes no central), termina", async () => {
    await database.update(municipio).set({ status: "criando" }).where(eq(municipio.slug, slug));
    const cpfs = CPFS_DE_EXEMPLO;
    expect((await database.select().from(paciente).where(inArray(paciente.cpf, cpfs))).length).toBe(3);
    await orchestrator.bancoDoMunicipio(slug).$client.end();
    orchestrator.esquecerBanco(slug);
    resumo = await semearExemplo(deps());
    const [linha] = await database.select().from(municipio).where(eq(municipio.slug, slug));
    expect(linha?.status).toBe("ativo");
    expect(await contagens()).toEqual({ unidades: 1, servicos: 2, estacoes: 3, sessoes: 2, entradas: 4 });
    const r = await database.execute<{ n: number }>(sql`select count(*)::int as n from paciente where email_verified`);
    expect(r.rows[0]?.n).toBeGreaterThanOrEqual(3);
  }, 60_000);
});
