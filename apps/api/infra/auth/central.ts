import { patientRegistrationSchema } from "@fila-saude/schemas/auth";
import { normalizeCpf, validCpf } from "@fila-saude/schemas/cpf";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { bearer, username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import database, { schemaCentral } from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import env from "infra/env";
import { ApiError, errorBody, validate } from "infra/errors";
import { bodyOf } from "./body";
import { authAsError } from "./errors";
import { loginLockout } from "./login-lockout";

// RN-ID-02: texto exato da orientação ao paciente quando o CPF já tem conta.
export const CPF_IN_USE_MESSAGE = "Procure a recepção da sua unidade para contestar.";

// Campos que o app nunca muda: o CPF é a identidade da conta (RN-ID-02) e a verificação só a
// recepção marca (RN-ID-05).
const IMMUTABLE_FIELDS = [
  "username",
  "displayUsername",
  "cpf",
  "verifiedAt",
  "verificationMethod",
  "verifiedMunicipality",
] as const;

// PD-23: o que o paciente pode trocar no próprio cadastro, com as mesmas regras do sign-up.
const patientUpdateSchema = patientRegistrationSchema.pick({ name: true, phone: true, birthDate: true }).partial();

// Erros do sign-up que, com o CPF já gravado por outra requisição, significam "CPF em uso".
const EXISTING_ACCOUNT_ERRORS = new Set([
  "FAILED_TO_CREATE_USER",
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "USERNAME_IS_ALREADY_TAKEN",
]);

async function cpfInUse(cpf: string) {
  const rows = await database.select({ id: patient.id }).from(patient).where(eq(patient.cpf, cpf)).limit(1);
  return rows.length > 0;
}

function cpfInUseError() {
  return new ApiError(409, "cpf_in_use", undefined, CPF_IN_USE_MESSAGE);
}

// O corpo da requisição é o mesmo objeto que o endpoint lê; trocá-lo no lugar é o que o próprio
// plugin username faz. Assim o que o cliente mandou a mais (ex.: `verificadoEm`) some.
function replaceBody(body: Record<string, unknown>, fresh: Record<string, unknown>) {
  for (const key of Object.keys(body)) delete body[key];
  Object.assign(body, fresh);
}

// RN-ID-01 / RN-ID-02 / PD-23: valida o cadastro no contrato em português e o traduz para o
// formato do better-auth (`name`, `email`, `password`, `username`).
async function prepareRegistration(body: Record<string, unknown>) {
  if (typeof body.cpf !== "string" || !validCpf(body.cpf)) throw new ApiError(400, "invalid_cpf");
  const data = validate(patientRegistrationSchema, body);
  if (await cpfInUse(data.cpf)) throw cpfInUseError();
  replaceBody(body, {
    name: data.name,
    email: data.email,
    password: data.password,
    username: data.cpf,
    cpf: data.cpf,
    birthDate: data.birthDate,
    phone: data.phone,
  });
}

function prepareUpdate(body: Record<string, unknown>, verified: boolean) {
  const fields: Record<string, string[]> = {};
  for (const key of IMMUTABLE_FIELDS) if (key in body) fields[key] = ["immutable_field"];
  if (Object.keys(fields).length > 0) throw new ApiError(400, "invalid_input", fields);
  const editable = Object.fromEntries(Object.entries(body).filter(([key]) => key in patientUpdateSchema.shape));
  const data = validate(patientUpdateSchema, editable);
  // RN-ID-05: a data de nascimento foi conferida no documento; mudar daria prioridade de idoso sem conferência.
  if (verified && data.birthDate !== undefined) {
    throw new ApiError(
      409,
      "birth_date_verified",
      undefined,
      "A data de nascimento foi conferida na recepção. Para corrigir, procure a recepção.",
    );
  }
  // Só os campos editáveis seguem, já normalizados (o resto do corpo some).
  replaceBody(body, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.birthDate !== undefined ? { birthDate: data.birthDate } : {}),
  });
}

// RN-ID-04: por CPF (só os dígitos, como o plugin guarda).
const lockout = loginLockout((ctx) => normalizeCpf(String(bodyOf(ctx).username ?? "")));

// T1.8 / AD-017 / PD-23: better-auth da central, montado em `/v1/auth` no host raiz. A tabela do
// usuário é `paciente`; `cpf` e `username` guardam o mesmo CPF só com dígitos.
export const authCentral = betterAuth({
  basePath: "/v1/auth",
  baseURL: env.CENTRAL_URL,
  database: drizzleAdapter(database, { provider: "pg", schema: schemaCentral }),
  user: {
    modelName: "patient",
    additionalFields: {
      cpf: { type: "string", required: true, input: true },
      birthDate: { type: "string", required: true, input: true },
      phone: { type: "string", required: true, input: true },
      // RN-ID-05: a conta nasce não verificada; só a recepção marca (nunca o cliente).
      verifiedAt: { type: "date", required: false, input: false },
      verificationMethod: { type: "string", required: false, input: false },
      verifiedMunicipality: { type: "string", required: false, input: false },
    },
  },
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // Responderia sem login se um CPF tem conta (oráculo de CPF): fica 404. O login é só por CPF
  // (`/sign-in/username`), onde as tentativas são contadas (RN-ID-04); por e-mail, fica 404.
  disabledPaths: ["/is-username-available", "/sign-in/email"],
  // bearer: o app nativo guarda o token e o manda em Authorization (sem cookie, sem Origin).
  plugins: [username({ usernameValidator: validCpf, minUsernameLength: 11, maxUsernameLength: 11 }), bearer()],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      try {
        await lockout.before(ctx);
        if (ctx.path === "/sign-up/email") await prepareRegistration(bodyOf(ctx));
        if (ctx.path === "/update-user") {
          const session = await getSessionFromCtx(ctx).catch(() => null);
          const verified = Boolean((session?.user as { verifiedAt?: Date | null } | undefined)?.verifiedAt);
          prepareUpdate(bodyOf(ctx), verified);
        }
      } catch (err) {
        throw authAsError(err);
      }
    }),
    // RN-ID-02: dois cadastros simultâneos passam pela checagem acima; o UNIQUE de `cpf`/`username`
    // derruba o segundo (o better-auth responde 422), e aqui a falha vira o mesmo `409 cpf_em_uso`.
    // Volta um `Response` pronto porque, num hook `after`, o better-auth mantém o status do erro
    // original mesmo quando o hook lança outro `APIError` (better-auth 1.6.23).
    after: createAuthMiddleware(async (ctx) => {
      const back = ctx.context.returned;
      await lockout.after(ctx);
      if (ctx.path !== "/sign-up/email" || !isAPIError(back)) return;
      if (!EXISTING_ACCOUNT_ERRORS.has(String(back.body?.code))) return;
      const cpf = bodyOf(ctx).cpf;
      if (typeof cpf !== "string" || !(await cpfInUse(cpf))) return;
      const error = cpfInUseError();
      return new Response(JSON.stringify(errorBody(error)), {
        status: error.status,
        headers: { "content-type": "application/json" },
      });
    }),
  },
});

export type AuthCentral = typeof authCentral;
