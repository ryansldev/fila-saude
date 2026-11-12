import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import env from "infra/env";
import { ErroApi } from "infra/erros";
import { criarTenant } from "infra/tenant/criar";
import { bancoDoSlug, validarSlug } from "infra/tenant/slug";
import { Client, escapeIdentifier } from "pg";
import { ULTIMA_MUNICIPAL } from "tests/migracoes";
import orchestrator from "tests/orchestrator";
import { afterAll, describe, expect, it } from "vitest";

const executar = promisify(execFile);
const pastaDaApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const deps = { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE };

function urlDoBanco(banco: string) {
  return env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", banco);
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

async function bancoExiste(banco: string) {
  const resultado = await conectado(env.DATABASE_URL, (c) =>
    c.query("select 1 from pg_database where datname = $1", [banco]),
  );
  return resultado.rowCount === 1;
}

async function tabelasDoTenant(banco: string) {
  return conectado(urlDoBanco(banco), async (c) => {
    const resultado = await c.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    return resultado.rows.map((l) => l.table_name).sort();
  });
}

async function linhasDoSlug(slug: string) {
  return database.select().from(municipio).where(eq(municipio.slug, slug));
}

function erroApi(status: number, codigo: string) {
  return expect.objectContaining({ name: "ErroApi", status, codigo });
}

describe("criarTenant", () => {
  afterAll(async () => {
    await orchestrator.derrubarMunicipios();
  });

  it("T1.7: tenant:create cria o banco, migra e registra ativo", async () => {
    const slug = orchestrator.slugUnico();

    const { stdout } = await executar(
      "npm",
      ["run", "--silent", "tenant:create", "--", "--slug", slug, "--nome", "Prefeitura A", "--uf", "SP"],
      { cwd: pastaDaApi, env: { ...process.env, NODE_ENV: "test" } },
    );

    const [linha] = await linhasDoSlug(slug);
    expect(linha).toMatchObject({
      slug,
      nome: "Prefeitura A",
      uf: "SP",
      fuso: "America/Sao_Paulo",
      status: "ativo",
      bancoRef: `template:${bancoDoSlug(slug)}`,
      migracaoVersao: ULTIMA_MUNICIPAL,
      migracaoErro: null,
    });
    expect(stdout).toContain(linha?.id);
    expect(await bancoExiste(bancoDoSlug(slug))).toBe(true);
    expect(await tabelasDoTenant(bancoDoSlug(slug))).toContain("pessoa_local");

    // Pelo caminho do Vitest (orchestrator) o resultado é o mesmo, com hífen no slug.
    const comHifen = `${orchestrator.slugUnico()}-b`;
    const criado = await orchestrator.criarMunicipio({ slug: comHifen, fuso: "America/Recife" });
    expect(criado.banco).toBe(`fila_t_${comHifen.replace("-", "_")}`);
    const [outra] = await linhasDoSlug(comHifen);
    expect(outra).toMatchObject({ id: criado.municipioId, status: "ativo", fuso: "America/Recife" });
    expect(await tabelasDoTenant(criado.banco)).toContain("pessoa_local");
  });

  it("slug: 3 e 30 caracteres aceitos, 2 e 31 recusados", async () => {
    expect(validarSlug("abc")).toBe(true);
    expect(validarSlug("a".repeat(30))).toBe(true);
    expect(validarSlug("ab")).toBe(false);
    expect(validarSlug("a".repeat(31))).toBe(false);

    // 30 caracteres cabem no nome do banco (limite de 63 do Postgres) e criam de verdade.
    const base = orchestrator.slugUnico();
    const trinta = base.padEnd(30, "x");
    const criado = await orchestrator.criarMunicipio({ slug: trinta });
    expect(await bancoExiste(criado.banco)).toBe(true);

    const trintaEUm = base.padEnd(31, "x");
    await expect(criarTenant({ slug: trintaEUm, nome: "X", uf: "SP" }, deps)).rejects.toEqual(
      erroApi(400, "slug_invalido"),
    );
    await expect(criarTenant({ slug: "ab", nome: "X", uf: "SP" }, deps)).rejects.toEqual(erroApi(400, "slug_invalido"));
    expect(await linhasDoSlug(trintaEUm)).toHaveLength(0);
    expect(await bancoExiste(bancoDoSlug(trintaEUm))).toBe(false);
  });

  it("slug: maiúscula, underscore, hífen no começo ou no fim recusados", async () => {
    for (const slug of ["Pref-a", "pref_a", "-pref-a", "pref-a-", "1pref", "pref a", "préf"]) {
      expect(validarSlug(slug), slug).toBe(false);
      await expect(criarTenant({ slug, nome: "X", uf: "SP" }, deps)).rejects.toBeInstanceOf(ErroApi);
      await expect(criarTenant({ slug, nome: "X", uf: "SP" }, deps)).rejects.toEqual(erroApi(400, "slug_invalido"));
      expect(await linhasDoSlug(slug)).toHaveLength(0);
    }
    expect(validarSlug("pref-a-1")).toBe(true);
  });

  it("slug repetido é recusado", async () => {
    const { slug, municipioId } = await orchestrator.criarMunicipio();

    await expect(criarTenant({ slug, nome: "Outra", uf: "RJ" }, deps)).rejects.toEqual(
      erroApi(409, "municipio_existe"),
    );
    const linhas = await linhasDoSlug(slug);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ id: municipioId, nome: `Município ${slug}`, uf: "SP", status: "ativo" });
  });

  it("L-003: duas criações simultâneas do mesmo slug criam um banco só", async () => {
    const slug = orchestrator.slugUnico();

    const resultados = await Promise.allSettled([
      criarTenant({ slug, nome: "A", uf: "SP" }, deps),
      criarTenant({ slug, nome: "A", uf: "SP" }, deps),
    ]);

    const cumpridos = resultados.filter((r) => r.status === "fulfilled");
    const recusados = resultados.filter((r) => r.status === "rejected");
    expect(cumpridos).toHaveLength(1);
    expect(recusados).toHaveLength(1);
    expect(recusados[0]?.reason).toEqual(erroApi(409, "municipio_existe"));

    const linhas = await linhasDoSlug(slug);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.status).toBe("ativo");
    expect(await tabelasDoTenant(bancoDoSlug(slug))).toContain("pessoa_local");
  });

  it("criação interrompida é retomada", async () => {
    const slug = orchestrator.slugUnico();
    const banco = bancoDoSlug(slug);
    const [interrompido] = await database
      .insert(municipio)
      .values({ slug, nome: "Interrompida", uf: "MG", bancoRef: `template:${banco}`, status: "criando" })
      .returning();
    await conectado(env.DATABASE_URL, (c) => c.query(`create database ${escapeIdentifier(banco)}`));

    const { municipioId } = await criarTenant({ slug, nome: "Interrompida", uf: "MG" }, deps);

    expect(municipioId).toBe(interrompido?.id);
    const linhas = await linhasDoSlug(slug);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ status: "ativo", migracaoVersao: ULTIMA_MUNICIPAL });
    expect(await tabelasDoTenant(banco)).toContain("pessoa_local");
  });
});
