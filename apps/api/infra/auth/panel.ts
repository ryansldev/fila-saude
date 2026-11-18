import { randomUUID } from "node:crypto";
import { properName } from "@fila-saude/domain";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { panelAccount, staffUser } from "infra/database/municipal/schema/auth";
import { schemaMunicipal, type TenantDatabase, type TenantDb } from "infra/database/tenants";
import env from "infra/env";
import { ApiError, errorBody } from "infra/errors";
import { panelOrigin } from "infra/panel/origin";
import webserver from "infra/webserver";
import { Attempts } from "./attempts";

// Origem da API no host do município (`http://<slug>.localhost:3333` em dev e teste).
export function tenantApiOrigin(slug: string): string {
  const url = new URL(webserver.origin);
  url.hostname = `${slug}.${env.TENANT_BASE_DOMAIN}`;
  return url.origin;
}

function build(slug: string, db: TenantDb) {
  return betterAuth({
    basePath: "/v1/panel/auth",
    baseURL: tenantApiOrigin(slug),
    trustedOrigins: [panelOrigin(slug)],
    database: drizzleAdapter(db, { provider: "pg", schema: schemaMunicipal }),
    user: { modelName: "staffUser" },
    session: { modelName: "panelSession" },
    account: { modelName: "panelAccount" },
    verification: { modelName: "staffVerification" },
    emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true },
    // A equipe muda login e nome só pela tela de equipe (com guard e auditoria). O login é só pelo
    // `login` (`/sign-in/username`), onde as tentativas contam (RN-ID-04); por e-mail, fica 404.
    disabledPaths: ["/is-username-available", "/update-user", "/sign-in/email"],
    advanced: { cookiePrefix: "fila-painel" },
    plugins: [username()],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== LOGIN || !loginAttempts.blocked(loginKey(slug, ctx), Date.now())) return;
        const error = new ApiError(
          429,
          "too_many_attempts",
          undefined,
          "Muitas tentativas com senha errada. Espere 15 minutos e tente de novo.",
        );
        // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
        throw new APIError(error.status as 400, errorBody(error));
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== LOGIN) return;
        if (isAPIError(ctx.context.returned)) loginAttempts.count(loginKey(slug, ctx), Date.now());
        else loginAttempts.reset(loginKey(slug, ctx));
      }),
    },
  });
}

// RN-ID-04: 5 senhas erradas seguidas no mesmo login do município bloqueiam por 15 min; acertar zera.
const LOGIN = "/sign-in/username";
const loginAttempts = new Attempts({ max: 5, windowMs: 15 * 60_000 });
const loginKey = (slug: string, ctx: { body?: unknown }) => {
  const body = ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};
  return `${slug}:${String(body.username ?? "").toLowerCase()}`;
};

export type PanelAuth = ReturnType<typeof build>;

// PD-39: uma instância do better-auth por banco de tenant (o banco muda quando o município é recriado).
const cache = new WeakMap<TenantDb, PanelAuth>();

export function tenantAuth(slug: string, db: TenantDb): PanelAuth {
  let auth = cache.get(db);
  if (!auth) {
    auth = build(slug, db);
    cache.set(db, auth);
  }
  return auth;
}

// T1.9: usuário do painel com senha (conta `credential`, hash do better-auth). Sem e-mail, um que não entrega.
export async function createStaffUser(
  db: TenantDatabase,
  data: { login: string; name: string; password: string; email?: string },
): Promise<{ id: string }> {
  const login = data.login.toLowerCase();
  const [exists] = await db.select({ id: staffUser.id }).from(staffUser).where(eq(staffUser.username, login));
  if (exists) throw new ApiError(409, "login_in_use");
  const id = randomUUID();
  await db.insert(staffUser).values({
    id,
    // Regra dos nomes: primeira letra maiúscula (a tabela da Equipe, o menu e a auditoria mostram assim).
    name: properName(data.name),
    email: data.email ?? `${login}@painel.invalid`,
    username: login,
    displayUsername: data.login,
  });
  await db.insert(panelAccount).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(data.password),
    updatedAt: new Date(),
  });
  return { id };
}
