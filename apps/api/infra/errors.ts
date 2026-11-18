import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { z } from "zod";

// Mensagens de validação em português para quem lê o erro no painel e no app.
z.config(z.locales.pt());

// PD-22: erro de negócio com status HTTP e código `snake_case`; `handleError` o converte em
// `{ erro: codigo, mensagem?, campos? }`. `mensagem` é texto para a pessoa (ex.: RN-ID-02).
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;
  userMessage?: string;
  data?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    fields?: Record<string, string[]>,
    message?: string,
    data?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
    if (message) this.userMessage = message;
    if (data) this.data = data;
  }
}

export type ErrorBody = {
  error: string;
  message?: string;
  fields?: Record<string, string[]>;
  data?: Record<string, unknown>;
};

// PD-22: o corpo da resposta de um `ErroApi`, sem chaves vazias.
export function errorBody(err: ApiError): ErrorBody {
  return {
    error: err.code,
    ...(err.userMessage ? { message: err.userMessage } : {}),
    ...(err.fields ? { fields: err.fields } : {}),
    ...(err.data ? { data: err.data } : {}),
  };
}

// PD-22: os problemas do Zod no formato `campos`: o caminho do campo (separado por ".") com as
// mensagens; erros na raiz ficam na chave "_".
export function zodFields(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const fields: Record<string, string[]> = {};
  for (const problem of issues) {
    const key = problem.path.length > 0 ? problem.path.map(String).join(".") : "_";
    const messages = fields[key] ?? [];
    messages.push(problem.message);
    fields[key] = messages;
  }
  return fields;
}

// PD-22: valida com um schema Zod de `packages/schemas`; o erro sai como `invalid_input` com os campos.
export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError(400, "invalid_input", zodFields(result.error.issues));
}

// PD-22: serializa qualquer erro no formato `{ erro, mensagem?, campos? }`; erro desconhecido não vaza mensagem.
export function handleError(err: unknown, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ApiError) {
    return reply.status(err.status).send(errorBody(err));
  }
  // Duas requisições ao mesmo tempo esbarraram num índice único (ex.: a mesma pessoa inscrita em
  // duas sessões do serviço): é conflito do cliente, não erro interno.
  const pg = (err as { code?: string; cause?: { code?: string } } | null) ?? {};
  if (pg.code === "23505" || pg.cause?.code === "23505") {
    return reply.status(409).send({ error: "duplicate" });
  }
  // Erros do próprio Fastify (JSON malformado, corpo grande, tipo não suportado).
  const status = (err as { statusCode?: number } | null)?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return reply.status(status).send({ error: "invalid_input" });
  }
  req.log.error(err);
  return reply.status(500).send({ error: "internal_error" });
}

export function notFound(_req: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({ error: "not_found" });
}

// Campos do domínio (`Record<campo, mensagem>`) no formato da PD-22.
export function domainFields(fields: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]]));
}
