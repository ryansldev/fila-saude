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

function codigoPeloStatus(status: number) {
  if (status === 401) return "nao_autenticado";
  if (status === 403) return "sem_permissao";
  if (status === 404) return "nao_encontrado";
  if (status === 429) return "muitas_tentativas";
  if (status >= 500) return "erro_interno";
  return "entrada_invalida";
}

// PD-22: erro do próprio better-auth (`{ code, message }` ou corpo vazio) vira `{ erro }`. Os erros
// dos hooks da Fila Saúde já saem no formato e passam como vieram.
function corpoDoErroDoAuth(status: number, texto: string): string {
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = null;
  }
  if (corpo && typeof corpo === "object" && "erro" in corpo) return texto;
  const codigo = (corpo as { code?: unknown } | null)?.code;
  return JSON.stringify({ erro: typeof codigo === "string" ? codigo.toLowerCase() : codigoPeloStatus(status) });
}

// AD-017: rota `GET|POST <prefixo>/*` que entrega a requisição ao `auth.handler` do better-auth e
// devolve a resposta dele pelo Fastify (status, cabeçalhos, todos os `set-cookie` e corpo).
export function montarAuth(app: FastifyInstance, prefixo: string, obterAuth: (req: FastifyRequest) => Auth) {
  app.route({
    method: ["GET", "POST"],
    url: `${prefixo}/*`,
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
        reply.header("content-type", "application/json; charset=utf-8");
        return reply.send(corpoDoErroDoAuth(resposta.status, texto));
      }
      return reply.send(texto === "" ? undefined : texto);
    },
  });
}
