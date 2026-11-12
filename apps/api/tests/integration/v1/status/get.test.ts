import { statusSchema } from "@fila-saude/schemas/status";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
});

describe("GET /api/v1/status", () => {
  it("should return 200", async () => {
    const response = await fetch(`${webserver.origin}/v1/status`);
    expect(response.status).toBe(200);

    const responseBody = statusSchema.parse(await response.json());
    const parsedUpdatedAt = new Date(responseBody.updated_at).toISOString();

    expect(responseBody.updated_at).toEqual(parsedUpdatedAt);
    expect(responseBody.dependencies.database.version).toEqual("18.4");
    expect(responseBody.dependencies.database.connections.max).toEqual(100);
    // O pool do servidor é compartilhado com os outros arquivos (PD-19); requisições simultâneas
    // anteriores (ex.: cadastro concorrente) deixam conexões ociosas por alguns segundos.
    expect(responseBody.dependencies.database.connections.total).toBeGreaterThanOrEqual(1);
    // `pg.Pool` padrão: no máximo 10 conexões; acima disso há vazamento.
    expect(responseBody.dependencies.database.connections.total).toBeLessThanOrEqual(10);
    expect(responseBody.dependencies.database.connections.waiting).toEqual(0);
  });
});
