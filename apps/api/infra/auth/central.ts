import { cadastroPacienteSchema } from "@fila-saude/schemas/auth";
import { cpfValido } from "@fila-saude/schemas/cpf";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import database, { schemaCentral } from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import env from "infra/env";
import { corpoDoErro, ErroApi, validar } from "infra/erros";

// RN-ID-02: texto exato da orientação ao paciente quando o CPF já tem conta.
export const MENSAGEM_CPF_EM_USO = "Procure a recepção da sua unidade para contestar.";

// Campos que o app nunca muda: o CPF é a identidade da conta (RN-ID-02) e a verificação só a
// recepção marca (RN-ID-05).
const CAMPOS_IMUTAVEIS = [
  "username",
  "displayUsername",
  "cpf",
  "verificadoEm",
  "verificadoMetodo",
  "verificadoMunicipio",
] as const;

// PD-23: o que o paciente pode trocar no próprio cadastro, com as mesmas regras do sign-up.
const atualizacaoPacienteSchema = cadastroPacienteSchema
  .pick({ nome: true, telefone: true, nascimento: true })
  .partial();

// Erros do sign-up que, com o CPF já gravado por outra requisição, significam "CPF em uso".
const ERROS_DE_CONTA_EXISTENTE = new Set([
  "FAILED_TO_CREATE_USER",
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "USERNAME_IS_ALREADY_TAKEN",
]);

async function cpfEmUso(cpf: string) {
  const linhas = await database.select({ id: paciente.id }).from(paciente).where(eq(paciente.cpf, cpf)).limit(1);
  return linhas.length > 0;
}

function erroCpfEmUso() {
  return new ErroApi(409, "cpf_em_uso", undefined, MENSAGEM_CPF_EM_USO);
}

// O corpo da requisição é o mesmo objeto que o endpoint lê; trocá-lo no lugar é o que o próprio
// plugin username faz. Assim o que o cliente mandou a mais (ex.: `verificadoEm`) some.
function substituirCorpo(corpo: Record<string, unknown>, novo: Record<string, unknown>) {
  for (const chave of Object.keys(corpo)) delete corpo[chave];
  Object.assign(corpo, novo);
}

// RN-ID-01 / RN-ID-02 / PD-23: valida o cadastro no contrato em português e o traduz para o
// formato do better-auth (`name`, `email`, `password`, `username`).
async function prepararCadastro(corpo: Record<string, unknown>) {
  if (typeof corpo.cpf !== "string" || !cpfValido(corpo.cpf)) throw new ErroApi(400, "cpf_invalido");
  const dados = validar(cadastroPacienteSchema, corpo);
  if (await cpfEmUso(dados.cpf)) throw erroCpfEmUso();
  substituirCorpo(corpo, {
    name: dados.nome,
    email: dados.email,
    password: dados.senha,
    username: dados.cpf,
    cpf: dados.cpf,
    nascimento: dados.nascimento,
    telefone: dados.telefone,
  });
}

function prepararAtualizacao(corpo: Record<string, unknown>) {
  const campos: Record<string, string[]> = {};
  for (const chave of CAMPOS_IMUTAVEIS) if (chave in corpo) campos[chave] = ["campo_imutavel"];
  if (Object.keys(campos).length > 0) throw new ErroApi(400, "entrada_invalida", campos);
  const editaveis = Object.fromEntries(
    Object.entries(corpo).filter(([chave]) => chave in atualizacaoPacienteSchema.shape),
  );
  const dados = validar(atualizacaoPacienteSchema, editaveis);
  // Grava os valores normalizados (telefone só com dígitos, nome sem espaços nas pontas).
  for (const [chave, valor] of Object.entries(dados)) if (valor !== undefined) corpo[chave] = valor;
}

// O better-auth responde direto, sem passar pelo handler de erros do Fastify: o `ErroApi` vira um
// `APIError` com o corpo já no formato da PD-22.
function comoErroDoAuth(err: unknown): unknown {
  // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
  return err instanceof ErroApi ? new APIError(err.status as 400, corpoDoErro(err)) : err;
}

function corpoDe(ctx: { body?: unknown }): Record<string, unknown> {
  return ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};
}

// T1.8 / AD-017 / PD-23: better-auth da central, montado em `/v1/auth` no host raiz. A tabela do
// usuário é `paciente`; `cpf` e `username` guardam o mesmo CPF só com dígitos.
export const authCentral = betterAuth({
  basePath: "/v1/auth",
  baseURL: env.CENTRAL_URL,
  database: drizzleAdapter(database, { provider: "pg", schema: schemaCentral }),
  user: {
    modelName: "paciente",
    additionalFields: {
      cpf: { type: "string", required: true, input: true },
      nascimento: { type: "string", required: true, input: true },
      telefone: { type: "string", required: true, input: true },
      // RN-ID-05: a conta nasce não verificada; só a recepção marca (nunca o cliente).
      verificadoEm: { type: "date", required: false, input: false },
      verificadoMetodo: { type: "string", required: false, input: false },
      verificadoMunicipio: { type: "string", required: false, input: false },
    },
  },
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // Responderia sem login se um CPF tem conta (oráculo de CPF): fica 404.
  disabledPaths: ["/is-username-available"],
  plugins: [username({ usernameValidator: cpfValido, minUsernameLength: 11, maxUsernameLength: 11 })],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      try {
        if (ctx.path === "/sign-up/email") await prepararCadastro(corpoDe(ctx));
        if (ctx.path === "/update-user") prepararAtualizacao(corpoDe(ctx));
      } catch (err) {
        throw comoErroDoAuth(err);
      }
    }),
    // RN-ID-02: dois cadastros simultâneos passam pela checagem acima; o UNIQUE de `cpf`/`username`
    // derruba o segundo (o better-auth responde 422), e aqui a falha vira o mesmo `409 cpf_em_uso`.
    // Volta um `Response` pronto porque, num hook `after`, o better-auth mantém o status do erro
    // original mesmo quando o hook lança outro `APIError` (better-auth 1.6.23).
    after: createAuthMiddleware(async (ctx) => {
      const retorno = ctx.context.returned;
      if (ctx.path !== "/sign-up/email" || !isAPIError(retorno)) return;
      if (!ERROS_DE_CONTA_EXISTENTE.has(String(retorno.body?.code))) return;
      const cpf = corpoDe(ctx).cpf;
      if (typeof cpf !== "string" || !(await cpfEmUso(cpf))) return;
      const erro = erroCpfEmUso();
      return new Response(JSON.stringify(corpoDoErro(erro)), {
        status: erro.status,
        headers: { "content-type": "application/json" },
      });
    }),
  },
});

export type AuthCentral = typeof authCentral;
