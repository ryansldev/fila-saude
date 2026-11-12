import retry from "async-retry";
import { inArray, sql } from "drizzle-orm";
import database from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import env from "infra/env";
import { criarTenant, type DadosDoTenant } from "infra/tenant/criar";
import { bancoDoSlug } from "infra/tenant/slug";
import webserver from "infra/webserver";
import { escapeIdentifier } from "pg";

async function waitForAllServices() {
  await waitForWebServer();

  async function waitForWebServer() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchStatusPage() {
      const response = await fetch(`${webserver.origin}/v1/status`);

      if (response.status !== 200) {
        throw Error();
      }
    }
  }
}

// Limpa os dados do central sem mexer no schema: as migrations já foram aplicadas pelo global-setup.
async function clearDatabase() {
  const tabelas = await database.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tabelas.rows.length === 0) return;

  const lista = sql.join(
    tabelas.rows.map((linha) => sql.identifier(linha.tablename)),
    sql`, `,
  );
  await database.execute(sql`truncate table ${lista} cascade`);
}

// PD-19: slugs gerados por este arquivo de teste; `derrubarMunicipios()` derruba o banco e a linha de cada um.
const slugsDoArquivo = new Set<string>();
let contadorDeSlugs = 0;

// `t<timestamp36><n>`: único entre arquivos e execuções, sempre válido para `validarSlug`.
function slugUnico() {
  contadorDeSlugs += 1;
  const slug = `t${Date.now().toString(36)}${contadorDeSlugs}`;
  slugsDoArquivo.add(slug);
  return slug;
}

// Cria o município no processo do Vitest, no mesmo Postgres que o servidor usa.
async function criarMunicipio(opcoes: Partial<DadosDoTenant> = {}) {
  const slug = opcoes.slug ?? slugUnico();
  slugsDoArquivo.add(slug);
  const { municipioId } = await criarTenant(
    { nome: `Município ${slug}`, uf: "SP", ...opcoes, slug },
    { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE },
  );
  return { municipioId, slug, banco: bancoDoSlug(slug) };
}

async function derrubarMunicipios() {
  const slugs = [...slugsDoArquivo];
  slugsDoArquivo.clear();
  for (const slug of slugs) {
    await database.execute(sql.raw(`drop database if exists ${escapeIdentifier(bancoDoSlug(slug))} with (force)`));
  }
  if (slugs.length > 0) {
    await database.delete(municipio).where(inArray(municipio.slug, slugs));
  }
}

// PD-15: origem do painel do município `slug` (`http://<slug>.localhost:3333` em teste).
function origemDoTenant(slug: string) {
  const url = new URL(webserver.origin);
  url.hostname = `${slug}.${env.TENANT_BASE_DOMAIN}`;
  return url.origin;
}

const orquestrator = {
  waitForAllServices,
  clearDatabase,
  slugUnico,
  criarMunicipio,
  derrubarMunicipios,
  origemDoTenant,
};

export default orquestrator;
