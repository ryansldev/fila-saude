import type { FastifyInstance, FastifyRequest } from "fastify";

// O que `montarAuth` usa de uma instância do better-auth (central ou, depois, a do tenant).
export type Auth = { handler: (request: Request) => Promise<Response> };

// Cabeçalhos que deixam de valer quando o corpo é serializado de novo.
const CABECALHOS_DO_CORPO = new Set(["content-length", "transfer-encoding"]);

function requisicaoWeb(req: FastifyRequest): Request {
  const headers = new Headers();
  for (const [chave, valor] of Object.entries(req.headers)) {
    if (valor === undefined || CABECALHOS_DO_CORPO.has(chave)) continue;
    for (const item of Array.isArray(valor) ? valor : [valor]) headers.append(chave, item);
  }
  const url = new URL(req.url, `${req.protocol}://${req.host}`);
  const temCorpo = req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined;
  return new Request(url, { method: req.method, headers, ...(temCorpo ? { body: JSON.stringify(req.body) } : {}) });
}

type CorpoPd22 = { erro: string; mensagem?: string; campos?: Record<string, string[]> };
type Traducao = { status: number; corpo: CorpoPd22 };

const entradaInvalida = (campo?: string, motivo = "invalido"): Traducao => ({
  status: 400,
  corpo: campo ? { erro: "entrada_invalida", campos: { [campo]: [motivo] } } : { erro: "entrada_invalida" },
});

// PD-22: códigos do better-auth (core e plugin username) alcançáveis em `/v1/auth/*`, em português.
const TRADUCOES: Record<string, Traducao> = {
  USER_ALREADY_EXISTS: { status: 409, corpo: { erro: "email_em_uso" } },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: { status: 409, corpo: { erro: "email_em_uso" } },
  INVALID_EMAIL_OR_PASSWORD: { status: 401, corpo: { erro: "credenciais_invalidas" } },
  INVALID_USERNAME_OR_PASSWORD: { status: 401, corpo: { erro: "credenciais_invalidas" } },
  PASSWORD_TOO_SHORT: entradaInvalida("senha", "senha_curta"),
  PASSWORD_TOO_LONG: entradaInvalida("senha", "senha_longa"),
  INVALID_PASSWORD: entradaInvalida("senha"),
  INVALID_EMAIL: entradaInvalida("email"),
  EMAIL_CAN_NOT_BE_UPDATED: entradaInvalida("email", "campo_imutavel"),
  INVALID_USERNAME: entradaInvalida("cpf", "cpf_invalido"),
  USERNAME_TOO_SHORT: entradaInvalida("cpf", "cpf_invalido"),
  USERNAME_TOO_LONG: entradaInvalida("cpf", "cpf_invalido"),
  FIELD_NOT_ALLOWED: entradaInvalida(),
  VALIDATION_ERROR: entradaInvalida(),
  MISSING_FIELD: entradaInvalida(),
  BODY_MUST_BE_AN_OBJECT: entradaInvalida(),
  SESSION_EXPIRED: { status: 401, corpo: { erro: "nao_autenticado" } },
  UNAUTHORIZED: { status: 401, corpo: { erro: "nao_autenticado" } },
};

// Sem código reconhecido: o status decide; nunca vaza o código em inglês.
function codigoPeloStatus(status: number) {
  if (status === 401) return "nao_autenticado";
  if (status === 403) return "sem_permissao";
  if (status === 404) return "nao_encontrado";
  if (status === 429) return "muitas_tentativas";
  if (status >= 500) return "erro_interno";
  return "erro_autenticacao";
}

// PD-22: erro do próprio better-auth (`{ code, message }` ou corpo vazio) vira `{ erro, campos? }`
// com o status da tabela acima. Os erros dos hooks da Fila Saúde já saem no formato e passam como vieram.
function traduzirErroDoAuth(status: number, texto: string): Traducao {
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = null;
  }
  if (corpo && typeof corpo === "object" && "erro" in corpo) return { status, corpo: corpo as CorpoPd22 };
  const codigo = (corpo as { code?: unknown } | null)?.code;
  const traducao = typeof codigo === "string" ? TRADUCOES[codigo] : undefined;
  return traducao ?? { status, corpo: { erro: codigoPeloStatus(status) } };
}

// AD-017: rota `GET|POST <prefixo>/*` que entrega a requisição ao `auth.handler` do better-auth e
// devolve a resposta dele pelo Fastify (status, cabeçalhos, todos os `set-cookie` e corpo).
export function montarAuth(
  app: FastifyInstance,
  prefixo: string,
  obterAuth: (req: FastifyRequest) => Auth,
  opcoes: { preHandler?: (req: FastifyRequest) => Promise<void> } = {},
) {
  app.route({
    method: ["GET", "POST"],
    url: `${prefixo}/*`,
    ...(opcoes.preHandler ? { preHandler: opcoes.preHandler } : {}),
    async handler(req, reply) {
      const resposta = await obterAuth(req).handler(requisicaoWeb(req));

      reply.status(resposta.status);
      resposta.headers.forEach((valor, chave) => {
        if (chave !== "set-cookie" && chave !== "content-length") reply.header(chave, valor);
      });
      const cookies = resposta.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);

      const texto = await resposta.text();
      if (resposta.status >= 400) {
        const { status, corpo } = traduzirErroDoAuth(resposta.status, texto);
        reply.status(status);
        reply.header("content-type", "application/json; charset=utf-8");
        return reply.send(corpo);
      }
      return reply.send(texto === "" ? undefined : texto);
    },
  });
}
