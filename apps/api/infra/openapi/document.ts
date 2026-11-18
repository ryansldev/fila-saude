import swagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { createJsonSchemaTransform, jsonSchemaTransformObject } from "fastify-type-provider-zod";
import { isPanelAuth } from "infra/panel/guard";

// DOC2 / DOC4: a referência da v1 sai das próprias rotas. Ficam fora as rotas de teste (PD-19) e as do
// better-auth (`/v1/auth/*`, `/v1/panel/auth/*`), que o guia de autenticação explica.
export function isOutsideReference(url: string) {
  return !url.startsWith("/v1/") || url.startsWith("/v1/test/") || isAuth(url);
}

// Rotas do better-auth: o paciente na central e a equipe no painel.
export function isAuth(url: string) {
  return url === "/v1/auth" || url.startsWith("/v1/auth/") || isPanelAuth(url);
}

const transform = createJsonSchemaTransform({ skipList: [] });

export function registerOpenApi(app: FastifyInstance) {
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Fila Saúde",
        version: "v1",
        description: "API da central de filas: app do paciente, painel da unidade e TV.",
      },
      servers: [
        {
          url: "http://{municipality}.localhost:3333",
          description: "Painel e TV: o município vem do subdomínio (PD-15)",
          variables: { municipality: { default: "exemplo" } },
        },
        { url: "http://localhost:3333", description: "App do paciente: o município vem do caminho (PD-15)" },
      ],
      components: {
        securitySchemes: {
          patientBearer: { type: "http", scheme: "bearer", description: "Sessão do paciente no app nativo" },
          patientCookie: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Sessão do paciente no app pela web",
          },
          panelCookie: {
            type: "apiKey",
            in: "cookie",
            name: "fila-painel.session_token",
            description: "Sessão do painel",
          },
          tvBearer: { type: "http", scheme: "bearer", description: "Token que a TV ganha ao se registrar (RN-TV-02)" },
        },
      },
    },
    transform: (document) => {
      if (isOutsideReference(document.url)) return { schema: { hide: true }, url: document.url };
      // O `autoload` registra `/v1/status/`; os clientes chamam sem a barra final.
      return { ...transform(document), url: document.url.replace(/(.)\/$/, "$1") };
    },
    transformObject: (document) => withoutUnusedSchemas(jsonSchemaTransformObject(document)),
  });
}

// O provider gera cada componente nas versões de entrada e de saída (`ApiErrorInput`, `ApiError`);
// fica só o que alguma operação cita.
function withoutUnusedSchemas<D extends object>(document: D): D {
  const schemas = (document as { components?: { schemas?: Record<string, unknown> } }).components?.schemas;
  if (!schemas) return document;
  const { components: _, ...rest } = document as { components?: unknown };
  const text = JSON.stringify(rest);
  for (const name of Object.keys(schemas)) {
    if (!text.includes(`"#/components/schemas/${name}"`)) delete schemas[name];
  }
  return document;
}

// O documento da v1, com o app pronto (as rotas registradas).
export async function openApiDocument(app: FastifyInstance) {
  await app.ready();
  return app.swagger();
}
