import { randomInt, randomUUID } from "node:crypto";
import type { Assignments } from "@fila-saude/domain";
import retry from "async-retry";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createStaffUser } from "infra/auth/panel";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { unit } from "infra/database/municipal/schema/unit";
import { schemaMunicipal, type TenantDb } from "infra/database/tenants";
import env from "infra/env";
import { panelOrigin } from "infra/panel/origin";
import { grantAssignments } from "infra/panel/profiles";
import { createTenant, type TenantData } from "infra/tenant/create";
import { databaseForSlug } from "infra/tenant/slug";
import webserver from "infra/webserver";
import { escapeIdentifier, Pool } from "pg";

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
  const tables = await database.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tables.rows.length === 0) return;

  const list = sql.join(
    tables.rows.map((row) => sql.identifier(row.tablename)),
    sql`, `,
  );
  await database.execute(sql`truncate table ${list} cascade`);
}

// PD-19: slugs gerados por este arquivo de teste; `derrubarMunicipios()` derruba o banco e a linha de cada um.
const fileSlugs = new Set<string>();
let slugsCounter = 0;

// `t<timestamp36><n>`: único entre arquivos e execuções, sempre válido para `validateSlug`.
function uniqueSlug() {
  slugsCounter += 1;
  const slug = `t${Date.now().toString(36)}${slugsCounter}`;
  fileSlugs.add(slug);
  return slug;
}

export const MANAGER_PASSWORD = "gestor-senha-1";

// Cria o município no processo do Vitest, no mesmo Postgres que o servidor usa. Sempre com o gestor
// `gestor` (senha `MANAGER_PASSWORD`), salvo `gestor: null`.
async function createMunicipality(options: Partial<TenantData> = {}) {
  const slug = options.slug ?? uniqueSlug();
  fileSlugs.add(slug);
  const manager =
    options.manager === undefined ? { login: "gestor", name: "Gestora", password: MANAGER_PASSWORD } : options.manager;
  const { municipalityId, managerId } = await createTenant(
    { name: `Município ${slug}`, uf: "SP", ...options, slug, ...(manager ? { manager } : {}) },
    { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE },
  );
  return { municipalityId, slug, database: databaseForSlug(slug), managerId: managerId ?? null };
}

// Banco do município no processo do Vitest (infra sem rota e preparação de dados).
const databases = new Map<string, TenantDb>();
function municipalityDatabase(slug: string): TenantDb {
  const existing = databases.get(slug);
  if (existing) return existing;
  const pool = new Pool({
    connectionString: env.TENANT_DATABASE_URL_TEMPLATE.replace("{database}", databaseForSlug(slug)),
    max: 3,
  });
  pool.on("error", () => {});
  const db = drizzle(pool, { schema: schemaMunicipal }) as TenantDb;
  databases.set(slug, db);
  return db;
}

function forgetDatabase(slug: string) {
  databases.delete(slug);
}

async function createUserWithProfiles(
  slug: string,
  login: string,
  assignments: Assignments,
  password = "senha-forte-1",
) {
  const db = municipalityDatabase(slug);
  const { id } = await createStaffUser(db, { login, name: login, password });
  await grantAssignments(db, id, assignments, null);
  return { id, login, password };
}

// Só para testes que precisam de uma unidade antes das rotas de unidade.
async function createDirectUnit(slug: string, name = "UBS Teste") {
  const [row] = await municipalityDatabase(slug)
    .insert(unit)
    .values({
      name,
      postalCode: "01001000",
      street: "Rua A",
      number: "1",
      neighborhood: "Centro",
      lat: -23.5,
      lng: -46.6,
      timeZone: "America/Sao_Paulo",
    })
    .returning({ id: unit.id });
  if (!row) throw new Error("unidade não criada");
  return row.id;
}

// Login no painel do município pela rota real; devolve o cabeçalho `cookie`.
async function loginStaff(slug: string, login: string, password: string) {
  const answer = await fetch(`${tenantOrigin(slug)}/v1/panel/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: panelOrigin(slug) },
    body: JSON.stringify({ username: login, password: password }),
  });
  if (answer.status !== 200) throw new Error(`login ${login} em ${slug}: ${answer.status} ${await answer.text()}`);
  return cookiesOf(answer);
}

async function loginManager(slug: string) {
  return loginStaff(slug, "gestor", MANAGER_PASSWORD);
}

// biome-ignore lint/suspicious/noExplicitAny: corpo de resposta nos testes, conferido por cada asserção.
export type AnswerJson = { status: number; body: any; headers: Headers };

// Requisição ao painel do município (Host do tenant, origem do painel).
async function panelRequest(
  slug: string,
  method: string,
  path: string,
  options: { cookie?: string; body?: unknown } = {},
): Promise<AnswerJson> {
  const headers: Record<string, string> = { origin: panelOrigin(slug) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const answer = await fetch(`${tenantOrigin(slug)}${path}`, {
    method: method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await answer.text();
  return { status: answer.status, body: text ? JSON.parse(text) : undefined, headers: answer.headers };
}

// Paciente cadastrado e logado na central; devolve o cookie e o id.
async function loginPatient(data = registrationData()) {
  const registration = await registerPatient(data);
  if (registration.status !== 200) throw new Error(`cadastro: ${registration.status} ${await registration.text()}`);
  const body = (await registration.json()) as { user: { id: string } };
  return { cookie: cookiesOf(registration), patientId: body.user.id, data };
}

async function dropMunicipalities() {
  const slugs = [...fileSlugs];
  fileSlugs.clear();
  for (const slug of slugs) {
    const db = databases.get(slug);
    databases.delete(slug);
    await db?.$client.end().catch(() => {});
  }
  for (const slug of slugs) {
    await database.execute(sql.raw(`drop database if exists ${escapeIdentifier(databaseForSlug(slug))} with (force)`));
  }
  if (slugs.length > 0) {
    await database.delete(municipality).where(inArray(municipality.slug, slugs));
  }
}

// PD-15: origem do painel do município `slug` (`http://<slug>.localhost:3333` em teste).
function tenantOrigin(slug: string) {
  const url = new URL(webserver.origin);
  url.hostname = `${slug}.${env.TENANT_BASE_DOMAIN}`;
  return url.origin;
}

// CPF válido: 9 dígitos aleatórios mais os verificadores (o banco de teste guarda contas entre execuções).
function generateCpf() {
  const base = String(randomInt(1_000_000_000)).padStart(9, "0");
  const digits = [...base].map(Number);
  // Nove dígitos iguais dariam um CPF inválido por definição; troca o último.
  if (digits.every((d) => d === digits[0])) digits[8] = ((digits[8] ?? 0) + 1) % 10;
  for (const weight of [10, 11]) {
    const sum = digits.reduce((acc, d, i) => acc + d * (weight - i), 0);
    const rest = (sum * 10) % 11;
    digits.push(rest === 10 ? 0 : rest);
  }
  return digits.join("");
}

export type RegistrationData = {
  cpf: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
};

// RN-ID-01 / PD-23: dados válidos de cadastro, com CPF e e-mail únicos.
function registrationData(options: Partial<RegistrationData> = {}): RegistrationData {
  const cpf = options.cpf ?? generateCpf();
  return {
    cpf,
    name: "Ana da Silva",
    email: `paciente-${randomUUID()}@exemplo.com.br`,
    phone: "(11) 98765-4321",
    birthDate: "1990-05-17",
    password: "senha-forte-1",
    ...options,
  };
}

// Cadastra o paciente pela rota real da central (`POST /v1/auth/sign-up/email`). `corpo` vai como veio,
// para os testes mandarem campos a mais ou a menos.
async function registerPatient(body: Record<string, unknown> = registrationData()) {
  return fetch(`${webserver.origin}/v1/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webserver.origin },
    body: JSON.stringify(body),
  });
}

// Converte os `set-cookie` de uma resposta no cabeçalho `cookie` da próxima requisição.
function cookiesOf(answer: Response) {
  return answer.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  uniqueSlug,
  createMunicipality,
  dropMunicipalities,
  tenantOrigin,
  generateCpf,
  registrationData,
  registerPatient,
  cookiesOf,
  municipalityDatabase,
  forgetDatabase,
  createUserWithProfiles,
  createDirectUnit,
  loginStaff,
  loginManager,
  panelRequest,
  loginPatient,
};

export default orchestrator;
