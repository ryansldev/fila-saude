import { randomInt, randomUUID } from "node:crypto";
import retry from "async-retry";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { criarUsuarioPainel } from "infra/auth/painel";
import database from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import { unidade } from "infra/database/municipal/schema/unidade";
import { type DbDoTenant, schemaMunicipal } from "infra/database/tenants";
import env from "infra/env";
import { origemDoPainel } from "infra/painel/origem";
import { concederPerfis, type PerfilComEscopo } from "infra/painel/perfis";
import { criarTenant, type DadosDoTenant } from "infra/tenant/criar";
import { bancoDoSlug } from "infra/tenant/slug";
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

export const SENHA_GESTOR = "gestor-senha-1";

// Cria o município no processo do Vitest, no mesmo Postgres que o servidor usa. Sempre com o gestor
// `gestor` (senha `SENHA_GESTOR`), salvo `gestor: null`.
async function criarMunicipio(opcoes: Partial<DadosDoTenant> = {}) {
  const slug = opcoes.slug ?? slugUnico();
  slugsDoArquivo.add(slug);
  const gestor =
    opcoes.gestor === undefined ? { login: "gestor", nome: "Gestora", senha: SENHA_GESTOR } : opcoes.gestor;
  const { municipioId, gestorId } = await criarTenant(
    { nome: `Município ${slug}`, uf: "SP", ...opcoes, slug, ...(gestor ? { gestor } : {}) },
    { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE },
  );
  return { municipioId, slug, banco: bancoDoSlug(slug), gestorId: gestorId ?? null };
}

// Banco do município no processo do Vitest (infra sem rota e preparação de dados).
const bancos = new Map<string, DbDoTenant>();
function bancoDoMunicipio(slug: string): DbDoTenant {
  const existente = bancos.get(slug);
  if (existente) return existente;
  const pool = new Pool({
    connectionString: env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", bancoDoSlug(slug)),
    max: 3,
  });
  pool.on("error", () => {});
  const db = drizzle(pool, { schema: schemaMunicipal }) as DbDoTenant;
  bancos.set(slug, db);
  return db;
}

function esquecerBanco(slug: string) {
  bancos.delete(slug);
}

async function criarUsuarioComPerfis(slug: string, login: string, perfis: PerfilComEscopo[], senha = "senha-forte-1") {
  const db = bancoDoMunicipio(slug);
  const { id } = await criarUsuarioPainel(db, { login, nome: login, senha });
  await concederPerfis(db, id, perfis, null);
  return { id, login, senha };
}

// Só para testes que precisam de uma unidade antes das rotas de unidade.
async function criarUnidadeDireto(slug: string, nome = "UBS Teste") {
  const [linha] = await bancoDoMunicipio(slug)
    .insert(unidade)
    .values({
      nome,
      cep: "01001000",
      logradouro: "Rua A",
      numero: "1",
      bairro: "Centro",
      lat: -23.5,
      lng: -46.6,
      fuso: "America/Sao_Paulo",
    })
    .returning({ id: unidade.id });
  if (!linha) throw new Error("unidade não criada");
  return linha.id;
}

// Login no painel do município pela rota real; devolve o cabeçalho `cookie`.
async function loginPainel(slug: string, login: string, senha: string) {
  const resposta = await fetch(`${origemDoTenant(slug)}/v1/painel/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: origemDoPainel(slug) },
    body: JSON.stringify({ username: login, password: senha }),
  });
  if (resposta.status !== 200)
    throw new Error(`login ${login} em ${slug}: ${resposta.status} ${await resposta.text()}`);
  return cookiesDe(resposta);
}

async function loginGestor(slug: string) {
  return loginPainel(slug, "gestor", SENHA_GESTOR);
}

// biome-ignore lint/suspicious/noExplicitAny: corpo de resposta nos testes, conferido por cada asserção.
export type RespostaJson = { status: number; corpo: any; headers: Headers };

// Requisição ao painel do município (Host do tenant, origem do painel).
async function pedirPainel(
  slug: string,
  metodo: string,
  caminho: string,
  opcoes: { cookie?: string; corpo?: unknown } = {},
): Promise<RespostaJson> {
  const headers: Record<string, string> = { origin: origemDoPainel(slug) };
  if (opcoes.cookie) headers.cookie = opcoes.cookie;
  if (opcoes.corpo !== undefined) headers["content-type"] = "application/json";
  const resposta = await fetch(`${origemDoTenant(slug)}${caminho}`, {
    method: metodo,
    headers,
    ...(opcoes.corpo !== undefined ? { body: JSON.stringify(opcoes.corpo) } : {}),
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : undefined, headers: resposta.headers };
}

// Paciente cadastrado e logado na central; devolve o cookie e o id.
async function loginPaciente(dados = dadosDeCadastro()) {
  const cadastro = await cadastrarPaciente(dados);
  if (cadastro.status !== 200) throw new Error(`cadastro: ${cadastro.status} ${await cadastro.text()}`);
  const corpo = (await cadastro.json()) as { user: { id: string } };
  return { cookie: cookiesDe(cadastro), pacienteId: corpo.user.id, dados };
}

async function derrubarMunicipios() {
  const slugs = [...slugsDoArquivo];
  slugsDoArquivo.clear();
  for (const slug of slugs) {
    const db = bancos.get(slug);
    bancos.delete(slug);
    await db?.$client.end().catch(() => {});
  }
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

// CPF válido: 9 dígitos aleatórios mais os verificadores (o banco de teste guarda contas entre execuções).
function gerarCpf() {
  const base = String(randomInt(1_000_000_000)).padStart(9, "0");
  const digitos = [...base].map(Number);
  // Nove dígitos iguais dariam um CPF inválido por definição; troca o último.
  if (digitos.every((d) => d === digitos[0])) digitos[8] = ((digitos[8] ?? 0) + 1) % 10;
  for (const peso of [10, 11]) {
    const soma = digitos.reduce((acc, d, i) => acc + d * (peso - i), 0);
    const resto = (soma * 10) % 11;
    digitos.push(resto === 10 ? 0 : resto);
  }
  return digitos.join("");
}

export type DadosDoCadastro = {
  cpf: string;
  nome: string;
  email: string;
  telefone: string;
  nascimento: string;
  senha: string;
};

// RN-ID-01 / PD-23: dados válidos de cadastro, com CPF e e-mail únicos.
function dadosDeCadastro(opcoes: Partial<DadosDoCadastro> = {}): DadosDoCadastro {
  const cpf = opcoes.cpf ?? gerarCpf();
  return {
    cpf,
    nome: "Ana da Silva",
    email: `paciente-${randomUUID()}@exemplo.com.br`,
    telefone: "(11) 98765-4321",
    nascimento: "1990-05-17",
    senha: "senha-forte-1",
    ...opcoes,
  };
}

// Cadastra o paciente pela rota real da central (`POST /v1/auth/sign-up/email`). `corpo` vai como veio,
// para os testes mandarem campos a mais ou a menos.
async function cadastrarPaciente(corpo: Record<string, unknown> = dadosDeCadastro()) {
  return fetch(`${webserver.origin}/v1/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webserver.origin },
    body: JSON.stringify(corpo),
  });
}

// Converte os `set-cookie` de uma resposta no cabeçalho `cookie` da próxima requisição.
function cookiesDe(resposta: Response) {
  return resposta.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const orquestrator = {
  waitForAllServices,
  clearDatabase,
  slugUnico,
  criarMunicipio,
  derrubarMunicipios,
  origemDoTenant,
  gerarCpf,
  dadosDeCadastro,
  cadastrarPaciente,
  cookiesDe,
  bancoDoMunicipio,
  esquecerBanco,
  criarUsuarioComPerfis,
  criarUnidadeDireto,
  loginPainel,
  loginGestor,
  pedirPainel,
  loginPaciente,
};

export default orquestrator;
