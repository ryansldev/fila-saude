import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { contaPainel, usuarioPainel } from "infra/database/municipal/schema/auth";
import { type BancoDoTenant, type DbDoTenant, schemaMunicipal } from "infra/database/tenants";
import env from "infra/env";
import { ErroApi } from "infra/erros";
import { origemDoPainel } from "infra/painel/origem";
import webserver from "infra/webserver";

// Origem da API no host do município (`http://<slug>.localhost:3333` em dev e teste).
export function origemDaApiDoTenant(slug: string): string {
  const url = new URL(webserver.origin);
  url.hostname = `${slug}.${env.TENANT_BASE_DOMAIN}`;
  return url.origin;
}

function montar(slug: string, db: DbDoTenant) {
  return betterAuth({
    basePath: "/v1/painel/auth",
    baseURL: origemDaApiDoTenant(slug),
    trustedOrigins: [origemDoPainel(slug)],
    database: drizzleAdapter(db, { provider: "pg", schema: schemaMunicipal }),
    user: { modelName: "usuarioPainel" },
    session: { modelName: "sessaoPainel" },
    account: { modelName: "contaPainel" },
    verification: { modelName: "verificacaoPainel" },
    emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true },
    disabledPaths: ["/is-username-available"],
    advanced: { cookiePrefix: "fila-painel" },
    plugins: [username()],
  });
}

export type AuthDoPainel = ReturnType<typeof montar>;

// PD-39: uma instância do better-auth por banco de tenant (o banco muda quando o município é recriado).
const cache = new WeakMap<DbDoTenant, AuthDoPainel>();

export function authDoTenant(slug: string, db: DbDoTenant): AuthDoPainel {
  let auth = cache.get(db);
  if (!auth) {
    auth = montar(slug, db);
    cache.set(db, auth);
  }
  return auth;
}

// T1.9: usuário do painel com senha (conta `credential`, hash do better-auth). Sem e-mail, um que não entrega.
export async function criarUsuarioPainel(
  db: BancoDoTenant,
  dados: { login: string; nome: string; senha: string; email?: string },
): Promise<{ id: string }> {
  const login = dados.login.toLowerCase();
  const [existe] = await db
    .select({ id: usuarioPainel.id })
    .from(usuarioPainel)
    .where(eq(usuarioPainel.username, login));
  if (existe) throw new ErroApi(409, "login_em_uso");
  const id = randomUUID();
  await db.insert(usuarioPainel).values({
    id,
    name: dados.nome,
    email: dados.email ?? `${login}@painel.invalid`,
    username: login,
    displayUsername: dados.login,
  });
  await db.insert(contaPainel).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(dados.senha),
    updatedAt: new Date(),
  });
  return { id };
}
