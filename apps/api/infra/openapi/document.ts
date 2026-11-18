import swagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { createJsonSchemaTransform, jsonSchemaTransformObject } from "fastify-type-provider-zod";
import { isPanelAuth } from "infra/panel/guard";
import { apiVersion, isUnder } from "infra/routes/versions";

// AD-066 / AD-068: a referência de cada versão (`/v{n}`) sai das próprias rotas. Ficam fora as rotas de
// teste (PD-19) e as do better-auth (`/v{n}/auth/*`, `/v{n}/panel/auth/*`), que o guia de autenticação
// explica.
export function isOutsideReference(url: string) {
  return !apiVersion(url) || isUnder(url, "test") || isAuth(url);
}

// Rotas do better-auth: o paciente na central e a equipe no painel.
export function isAuth(url: string) {
  return isUnder(url, "auth") || isPanelAuth(url);
}

const transform = createJsonSchemaTransform({ skipList: [] });

export function registerOpenApi(app: FastifyInstance) {
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Fila Saúde",
        // Cada documento por versão recebe a sua (`splitByVersion`).
        version: "",
        description: "API da central de filas: app do paciente, painel da unidade e TV.",
      },
      servers: [
        {
          url: "http://{municipality}.localhost:3333",
          description: "Painel e TV: o município vem do subdomínio",
          variables: { municipality: { default: "exemplo" } },
        },
        { url: "http://localhost:3333", description: "App do paciente: o município vem do caminho" },
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
          tvBearer: { type: "http", scheme: "bearer", description: "Token que a TV ganha ao se registrar" },
        },
      },
    },
    transform: (document) => {
      if (isOutsideReference(document.url)) return { schema: { hide: true }, url: document.url };
      const out = transform(document);
      // O `@fastify/swagger` chama de "Default Response" a resposta sem descrição: a 2xx com corpo vira
      // "Sucesso" (ou a descrição do próprio schema).
      const responses = (out.schema as { response?: Record<string, Record<string, unknown>> }).response ?? {};
      // Só as 2xx com corpo: o 204 (`NO_CONTENT`) já sai sem corpo, e os erros já têm os códigos.
      for (const [status, response] of Object.entries(responses)) {
        if (!/^2\d\d$/.test(status) || status === "204" || "content" in response) continue;
        const description = typeof response.description === "string" ? response.description : "Sucesso";
        responses[status] = { description, content: { "application/json": { schema: response } } };
      }
      // O `autoload` registra `/v{n}/status/`; os clientes chamam sem a barra final.
      return { ...out, url: document.url.replace(/(.)\/$/, "$1") };
    },
    transformObject: jsonSchemaTransformObject,
  });
}

type OpenApiDocument = {
  info: { version: string };
  paths?: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
};

// Os componentes que os caminhos citam, e os que esses componentes citam (um schema dentro de outro).
function usedSchemas(paths: unknown, schemas: Record<string, unknown>): Record<string, unknown> {
  const used = new Set<string>();
  const pending = [JSON.stringify(paths)];
  while (pending.length > 0) {
    const text = pending.pop() ?? "";
    for (const [, name] of text.matchAll(/"#\/components\/schemas\/([^"]+)"/g)) {
      if (!name || used.has(name) || !(name in schemas)) continue;
      used.add(name);
      pending.push(JSON.stringify(schemas[name]));
    }
  }
  return Object.fromEntries(Object.entries(schemas).filter(([name]) => used.has(name)));
}

// AD-068: um documento por versão, cada um só com os caminhos dela e os componentes que eles usam (o
// provider gera cada componente nas versões de entrada e de saída, como `ApiErrorInput` e `ApiError`).
export function splitByVersion<D extends OpenApiDocument>(document: D): Record<string, D> {
  const byVersion = new Map<string, Record<string, unknown>>();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    const version = apiVersion(path);
    if (!version) continue;
    const paths = byVersion.get(version) ?? {};
    paths[path] = item;
    byVersion.set(version, paths);
  }
  const docs: Record<string, D> = {};
  for (const [version, paths] of byVersion) {
    docs[version] = {
      ...document,
      info: { ...document.info, version },
      paths,
      components: { ...document.components, schemas: usedSchemas(paths, document.components?.schemas ?? {}) },
    };
  }
  return docs;
}

// Os documentos de todas as versões do app (as rotas já registradas, depois do `ready`).
export function openApiDocumentsOf(app: FastifyInstance) {
  return splitByVersion(app.swagger() as unknown as OpenApiDocument);
}

// Os documentos de todas as versões, com o app pronto.
export async function openApiDocuments(app: FastifyInstance) {
  await app.ready();
  return openApiDocumentsOf(app);
}
