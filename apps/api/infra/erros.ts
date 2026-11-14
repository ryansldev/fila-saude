import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { z } from "zod";

// Mensagens de validação em português para quem lê o erro no painel e no app.
z.config(z.locales.pt());

// PD-22: erro de negócio com status HTTP e código `snake_case`; `tratarErro` o converte em
// `{ erro: codigo, mensagem?, campos? }`. `mensagem` é texto para a pessoa (ex.: RN-ID-02).
export class ErroApi extends Error {
  status: number;
  codigo: string;
  campos?: Record<string, string[]>;
  mensagem?: string;
  dados?: Record<string, unknown>;

  constructor(
    status: number,
    codigo: string,
    campos?: Record<string, string[]>,
    mensagem?: string,
    dados?: Record<string, unknown>,
  ) {
    super(codigo);
    this.name = "ErroApi";
    this.status = status;
    this.codigo = codigo;
    if (campos) this.campos = campos;
    if (mensagem) this.mensagem = mensagem;
    if (dados) this.dados = dados;
  }
}

export type CorpoDoErro = {
  erro: string;
  mensagem?: string;
  campos?: Record<string, string[]>;
  dados?: Record<string, unknown>;
};

// PD-22: o corpo da resposta de um `ErroApi`, sem chaves vazias.
export function corpoDoErro(err: ErroApi): CorpoDoErro {
  return {
    erro: err.codigo,
    ...(err.mensagem ? { mensagem: err.mensagem } : {}),
    ...(err.campos ? { campos: err.campos } : {}),
    ...(err.dados ? { dados: err.dados } : {}),
  };
}

// PD-22: valida com um schema Zod de `packages/schemas`; `campos` mapeia o caminho do campo
// (separado por ".") às mensagens, e erros na raiz ficam na chave "_".
export function validar<T>(schema: ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (resultado.success) return resultado.data;

  const campos: Record<string, string[]> = {};
  for (const problema of resultado.error.issues) {
    const chave = problema.path.length > 0 ? problema.path.join(".") : "_";
    const mensagens = campos[chave] ?? [];
    mensagens.push(problema.message);
    campos[chave] = mensagens;
  }
  throw new ErroApi(400, "entrada_invalida", campos);
}

// PD-22: serializa qualquer erro no formato `{ erro, mensagem?, campos? }`; erro desconhecido não vaza mensagem.
export function tratarErro(err: unknown, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ErroApi) {
    return reply.status(err.status).send(corpoDoErro(err));
  }
  // Duas requisições ao mesmo tempo esbarraram num índice único (ex.: a mesma pessoa inscrita em
  // duas sessões do serviço): é conflito do cliente, não erro interno.
  const pg = (err as { code?: string; cause?: { code?: string } } | null) ?? {};
  if (pg.code === "23505" || pg.cause?.code === "23505") {
    return reply.status(409).send({ erro: "duplicada" });
  }
  // Erros do próprio Fastify (JSON malformado, corpo grande, tipo não suportado).
  const status = (err as { statusCode?: number } | null)?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return reply.status(status).send({ erro: "entrada_invalida" });
  }
  req.log.error(err);
  return reply.status(500).send({ erro: "erro_interno" });
}

export function naoEncontrado(_req: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({ erro: "nao_encontrado" });
}

// Campos do domínio (`Record<campo, mensagem>`) no formato da PD-22.
export function camposDoDominio(campos: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, [v]]));
}
