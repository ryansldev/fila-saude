import type { FastifyRouteSchemaDef } from "fastify/types/schema";
import { ApiError } from "infra/errors";
import { serializerCompiler, validatorCompiler } from "infra/openapi/compilers";
import { describe, expect, it } from "vitest";
import { z } from "zod";

function def(schema: unknown, httpPart = "body") {
  return { schema, method: "POST", url: "/v1/x", httpPart } as FastifyRouteSchemaDef<z.ZodType>;
}

describe("compiladores Zod do Fastify (DOC2)", () => {
  it("corpo inválido → ApiError 400 invalid_input com os campos", () => {
    const check = validatorCompiler(def(z.object({ n: z.number() })));
    const { error } = check({ n: "x" }) as { error: ApiError };
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("invalid_input");
    expect(Object.keys(error.fields ?? {})).toEqual(["n"]);
  });

  it("id inválido no caminho → 404 not_found (como o pathId)", () => {
    const check = validatorCompiler(def(z.object({ unitId: z.uuid() }), "params"));
    const { error } = check({ unitId: "abc" }) as { error: ApiError };
    expect(error.status).toBe(404);
    expect(error.code).toBe("not_found");
    expect(error.fields).toBeUndefined();
  });

  it("schema que não é Zod falha ao montar a rota, não a cada pedido", () => {
    expect(() => validatorCompiler(def({ type: "object" }))).toThrow(/Zod/);
    expect(() => serializerCompiler(def({ type: "object" }))).toThrow(/Zod/);
  });
});
