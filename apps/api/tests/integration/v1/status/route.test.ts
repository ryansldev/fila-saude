import { StatusSchema } from "@fila-saude/schemas/status";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/status", () => {
  it("should return 200", async () => {
    const response = await fetch(`${webserver.origin}/v1/status`);
    expect(response.status).toBe(200);

    const responseBody = StatusSchema.parse(await response.json());
    const parsedUpdatedAt = new Date(responseBody.updated_at).toISOString();

    expect(responseBody.updated_at).toEqual(parsedUpdatedAt);
    expect(responseBody.dependencies.database.version).toEqual("18.4");
    expect(responseBody.dependencies.database.connections.max).toEqual(100);
    expect(responseBody.dependencies.database.connections.total).toEqual(1);
    expect(responseBody.dependencies.database.connections.waiting).toEqual(0);
  });
});
