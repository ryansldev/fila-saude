import type { FastifySchemaCompiler } from "fastify";
import type { FastifySerializerCompiler } from "fastify/types/schema";
import { ApiError, zodFields } from "infra/errors";
import { ZodType } from "zod";

// DOC2: todo schema de rota é Zod; outro formato falha ao montar a rota, não a cada pedido.
function zod(schema: unknown, method: string, url: string): ZodType {
  if (schema instanceof ZodType) return schema;
  throw new Error(`o schema de ${method} ${url} não é Zod`);
}

// DOC2 / PD-22: o Fastify valida params, query e corpo com o schema Zod da rota; o erro é o mesmo
// `invalid_input` com campos do `validate()` (o Fastify repassa o `ApiError` ao `handleError`).
// Id inválido no caminho é recurso inexistente: 404, como o `pathId`.
export const validatorCompiler: FastifySchemaCompiler<ZodType> = ({ schema, method, url, httpPart }) => {
  const checked = zod(schema, method, url);
  return (data) => {
    const result = checked.safeParse(data);
    if (result.success) return { value: result.data };
    if (httpPart === "params") return { error: new ApiError(404, "not_found") };
    return { error: new ApiError(400, "invalid_input", zodFields(result.error.issues)) };
  };
};

// DOC2: a resposta passa pelo `parse` (como o `validate()` fazia), não pelo `encode`: os schemas com
// `transform` (CEP, telefone) não têm volta. Fora do schema é bug do servidor: o `handleError` dá 500.
export const serializerCompiler: FastifySerializerCompiler<ZodType> = ({ schema, method, url }) => {
  const checked = zod(schema, method, url);
  return (data) => {
    const result = checked.safeParse(data);
    if (!result.success) {
      throw new Error(`resposta fora do schema em ${method} ${url}`, { cause: result.error });
    }
    return JSON.stringify(result.data);
  };
};
