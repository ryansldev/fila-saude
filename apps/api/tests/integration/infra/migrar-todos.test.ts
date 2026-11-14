import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import { migrarTodos } from "infra/database/migrar";
import env from "infra/env";
import { bancoDoSlug } from "infra/tenant/slug";
import { Client, escapeIdentifier } from "pg";
import { ULTIMA_MUNICIPAL } from "tests/migracoes";
import orchestrator from "tests/orchestrator";
import { afterAll, describe, expect, it } from "vitest";

const executar = promisify(execFile);
const pastaDaApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const deps = { central: database, urlCentral: env.DATABASE_URL, template: env.TENANT_DATABASE_URL_TEMPLATE };

function urlDoServidor() {
  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}

async function conectado<T>(url: string, fn: (cliente: Client) => Promise<T>) {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    return await fn(cliente);
  } finally {
    await cliente.end();
  }
}

async function linhaDoSlug(slug: string) {
  const [linha] = await database.select().from(municipio).where(eq(municipio.slug, slug));
  return linha;
}

// Simula um município que perdeu as migrations: apaga o histórico do drizzle e as tabelas.
async function zerarMigrations(banco: string) {
  await conectado(env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", banco), (c) =>
    c.query("drop schema drizzle cascade; drop schema public cascade; create schema public"),
  );
}

async function tabelasDoTenant(banco: string) {
  return conectado(env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", banco), async (c) => {
    const resultado = await c.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    return resultado.rows.map((l) => l.table_name);
  });
}

// Banco "central" descartável para o script: o nome cai no padrão que o global-setup limpa.
const centralDoScript = `fila_t_${Date.now().toString(36)}central`;

describe("migrarTodos", () => {
  afterAll(async () => {
    await orchestrator.derrubarMunicipios();
    await conectado(urlDoServidor(), (c) =>
      c.query(`drop database if exists ${escapeIdentifier(centralDoScript)} with (force)`),
    );
  });

  it("PD-16: migra o central e todos os tenants", async () => {
    const a = await orchestrator.criarMunicipio();
    const b = await orchestrator.criarMunicipio();
    await zerarMigrations(a.banco);
    await zerarMigrations(b.banco);
    await database.update(municipio).set({ migracaoVersao: null }).where(eq(municipio.slug, a.slug));
    await database.update(municipio).set({ migracaoVersao: null }).where(eq(municipio.slug, b.slug));

    const resultado = await migrarTodos(deps);

    expect(resultado.central).toBe("0002_dispositivo_push");
    for (const { slug, banco } of [a, b]) {
      expect(resultado.tenants).toContainEqual({ slug, ok: true, versao: ULTIMA_MUNICIPAL });
      expect(await linhaDoSlug(slug)).toMatchObject({ migracaoVersao: ULTIMA_MUNICIPAL, migracaoErro: null });
      expect(await tabelasDoTenant(banco)).toContain("pessoa_local");
    }
  });

  it("PD-16: tenant com banco inacessível é marcado e os outros seguem", async () => {
    const quebrado = orchestrator.slugUnico();
    const suspenso = orchestrator.slugUnico();
    await database.insert(municipio).values([
      { slug: quebrado, nome: "Quebrado", uf: "SP", bancoRef: `template:${bancoDoSlug(quebrado)}`, status: "ativo" },
      { slug: suspenso, nome: "Suspenso", uf: "SP", bancoRef: `template:${bancoDoSlug(suspenso)}`, status: "suspenso" },
    ]);
    // Criado depois: na ordem de criação o quebrado vem antes, então um erro que parasse o laço apareceria.
    const ok = await orchestrator.criarMunicipio();
    await zerarMigrations(ok.banco);

    const resultado = await migrarTodos(deps);

    const doQuebrado = resultado.tenants.find((t) => t.slug === quebrado);
    expect(doQuebrado).toMatchObject({ slug: quebrado, ok: false, erro: expect.stringContaining("does not exist") });
    expect(await linhaDoSlug(quebrado)).toMatchObject({
      migracaoVersao: null,
      migracaoErro: expect.stringContaining("does not exist"),
    });

    expect(resultado.tenants).toContainEqual({ slug: ok.slug, ok: true, versao: ULTIMA_MUNICIPAL });
    expect(await tabelasDoTenant(ok.banco)).toContain("pessoa_local");

    // Suspenso não entra na rodada.
    expect(resultado.tenants.find((t) => t.slug === suspenso)).toBeUndefined();
    expect(await linhaDoSlug(suspenso)).toMatchObject({ migracaoVersao: null, migracaoErro: null });
  });

  it("PD-16: a próxima execução retoma e limpa o erro", async () => {
    const slug = orchestrator.slugUnico();
    const banco = bancoDoSlug(slug);
    await database
      .insert(municipio)
      .values({ slug, nome: "Retomada", uf: "SP", bancoRef: `template:${banco}`, status: "criando" });

    const primeira = await migrarTodos(deps);
    expect(primeira.tenants.find((t) => t.slug === slug)?.ok).toBe(false);
    expect((await linhaDoSlug(slug))?.migracaoErro).toEqual(expect.any(String));

    await conectado(urlDoServidor(), (c) => c.query(`create database ${escapeIdentifier(banco)}`));
    const segunda = await migrarTodos(deps);

    expect(segunda.tenants).toContainEqual({ slug, ok: true, versao: ULTIMA_MUNICIPAL });
    expect(await linhaDoSlug(slug)).toMatchObject({ migracaoVersao: ULTIMA_MUNICIPAL, migracaoErro: null });
    expect(await tabelasDoTenant(banco)).toContain("pessoa_local");
  });

  it("PD-16: db:migrate cria o central se faltar e sai com 1 quando um tenant falha", async () => {
    const ambiente = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", centralDoScript),
      POSTGRES_DB: centralDoScript,
    };
    const rodar = () => executar("npm", ["run", "--silent", "db:migrate"], { cwd: pastaDaApi, env: ambiente });

    // Banco central ainda não existe: o script cria, migra e, sem tenants, sai com 0.
    const { stdout } = await rodar();
    expect(stdout).toContain("central: 0002_dispositivo_push");
    const tabelas = await conectado(ambiente.DATABASE_URL, async (c) => {
      const r = await c.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public'",
      );
      return r.rows.map((l) => l.table_name);
    });
    expect(tabelas).toContain("municipio");

    const quebrado = orchestrator.slugUnico();
    await conectado(ambiente.DATABASE_URL, (c) =>
      c.query("insert into municipio (slug, nome, uf, banco_ref, status) values ($1, 'Q', 'SP', $2, 'ativo')", [
        quebrado,
        `template:${bancoDoSlug(quebrado)}`,
      ]),
    );

    const falha = await rodar().then(
      () => null,
      (erro: { code: number; stderr: string }) => erro,
    );
    expect(falha?.code).toBe(1);
    expect(falha?.stderr).toContain(quebrado);
  });
});
