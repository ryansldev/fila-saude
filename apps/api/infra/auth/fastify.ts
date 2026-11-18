import type { FastifyInstance, FastifyRequest } from "fastify";

// O que `buildAuth` usa de uma instância do better-auth (central ou, depois, a do tenant).
export type Auth = { handler: (request: Request) => Promise<Response> };

// Cabeçalhos que deixam de valer quando o corpo é serializado de novo, e os de IP e de host repassado,
// que o cliente pode inventar: o IP vai só no `x-forwarded-for`, trocado pelo que o Fastify resolveu.
const DROPPED_HEADERS = new Set([
  "content-length",
  "transfer-encoding",
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "x-forwarded-host",
]);

/** NC5: o `trustProxy` do Fastify; sem proxy configurado, nenhum (nunca `true`, que confiaria em todos). */
export function trustProxyOption(proxies: string[]): string[] | false {
  return proxies.length > 0 ? proxies : false;
}

// NC5: o better-auth (limitador e contagem de tentativas) lê o IP do `X-Forwarded-For`. Ele recebe só o
// `req.ip`, que o Fastify resolve pelo `trustProxy` (TRUSTED_PROXIES): o que o cliente inventa no
// cabeçalho não chega lá, e atrás do proxy cada pessoa tem o próprio IP, não o do proxy. O endereço usa o
// `Host` do pedido, o mesmo que resolve o município, e não o `X-Forwarded-Host`.
export function webRequest(req: FastifyRequest): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || DROPPED_HEADERS.has(key)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
  }
  // Sem IP (a conexão caiu no meio do pedido), vai sem o cabeçalho, e não com "undefined".
  if (req.ip) headers.set("x-forwarded-for", req.ip);
  const url = new URL(req.url, `${req.protocol}://${req.headers.host}`);
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined;
  return new Request(url, { method: req.method, headers, ...(hasBody ? { body: JSON.stringify(req.body) } : {}) });
}

type BodyPd22 = { error: string; message?: string; fields?: Record<string, string[]> };
type Translation = { status: number; body: BodyPd22 };

const invalidEntry = (field?: string, reason = "invalid"): Translation => ({
  status: 400,
  body: field ? { error: "invalid_input", fields: { [field]: [reason] } } : { error: "invalid_input" },
});

// PD-22: códigos do better-auth (core e plugin username) alcançáveis em `/v1/auth/*`, em português.
const TRANSLATIONS: Record<string, Translation> = {
  USER_ALREADY_EXISTS: { status: 409, body: { error: "email_in_use" } },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: { status: 409, body: { error: "email_in_use" } },
  INVALID_EMAIL_OR_PASSWORD: { status: 401, body: { error: "invalid_credentials" } },
  INVALID_USERNAME_OR_PASSWORD: { status: 401, body: { error: "invalid_credentials" } },
  PASSWORD_TOO_SHORT: invalidEntry("password", "password_too_short"),
  PASSWORD_TOO_LONG: invalidEntry("password", "password_too_long"),
  INVALID_PASSWORD: invalidEntry("password"),
  INVALID_EMAIL: invalidEntry("email"),
  EMAIL_CAN_NOT_BE_UPDATED: invalidEntry("email", "immutable_field"),
  INVALID_USERNAME: invalidEntry("cpf", "invalid_cpf"),
  USERNAME_TOO_SHORT: invalidEntry("cpf", "invalid_cpf"),
  USERNAME_TOO_LONG: invalidEntry("cpf", "invalid_cpf"),
  FIELD_NOT_ALLOWED: invalidEntry(),
  VALIDATION_ERROR: invalidEntry(),
  MISSING_FIELD: invalidEntry(),
  BODY_MUST_BE_AN_OBJECT: invalidEntry(),
  SESSION_EXPIRED: { status: 401, body: { error: "not_authenticated" } },
  UNAUTHORIZED: { status: 401, body: { error: "not_authenticated" } },
};

// Sem código reconhecido: o status decide; nunca vaza o código em inglês.
function codeByStatus(status: number) {
  if (status === 401) return "not_authenticated";
  if (status === 403) return "no_permission";
  if (status === 404) return "not_found";
  if (status === 429) return "too_many_attempts";
  if (status >= 500) return "internal_error";
  return "auth_error";
}

// PD-22: erro do próprio better-auth (`{ code, message }` ou corpo vazio) vira `{ erro, campos? }`
// com o status da tabela acima. Os erros dos hooks da Fila Saúde já saem no formato e passam como vieram.
// O plugin username guarda o CPF no app do paciente e o login no painel: o erro vai no campo de cada um.
const USERNAME_CODES = new Set(["INVALID_USERNAME", "USERNAME_TOO_SHORT", "USERNAME_TOO_LONG"]);
export type UsernameField = "cpf" | "login";

function translateAuthError(status: number, text: string, usernameField: UsernameField = "cpf"): Translation {
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (body && typeof body === "object" && "error" in body) return { status, body: body as BodyPd22 };
  const code = (body as { code?: unknown } | null)?.code;
  if (usernameField === "login" && typeof code === "string" && USERNAME_CODES.has(code))
    return invalidEntry("login", "invalid_login");
  const translation = typeof code === "string" ? TRANSLATIONS[code] : undefined;
  return translation ?? { status, body: { error: codeByStatus(status) } };
}

// AD-017: rota `GET|POST <prefixo>/*` que entrega a requisição ao `auth.handler` do better-auth e
// devolve a resposta dele pelo Fastify (status, cabeçalhos, todos os `set-cookie` e corpo).
export function buildAuth(
  app: FastifyInstance,
  prefix: string,
  getAuth: (req: FastifyRequest) => Auth,
  options: { preHandler?: (req: FastifyRequest) => Promise<void>; usernameField?: UsernameField } = {},
) {
  app.route({
    method: ["GET", "POST"],
    url: `${prefix}/*`,
    ...(options.preHandler ? { preHandler: options.preHandler } : {}),
    async handler(req, reply) {
      const answer = await getAuth(req).handler(webRequest(req));

      reply.status(answer.status);
      answer.headers.forEach((value, key) => {
        if (key !== "set-cookie" && key !== "content-length") reply.header(key, value);
      });
      const cookies = answer.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);

      const text = await answer.text();
      if (answer.status >= 400) {
        const { status, body } = translateAuthError(answer.status, text, options.usernameField);
        reply.status(status);
        reply.header("content-type", "application/json; charset=utf-8");
        return reply.send(body);
      }
      return reply.send(text === "" ? undefined : text);
    },
  });
}
