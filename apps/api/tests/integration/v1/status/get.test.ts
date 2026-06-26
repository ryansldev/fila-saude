import webserver from "@fila-saude/api/infra/webserver";
import { statusSchema } from "@fila-saude/schemas/status";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/status", () => {
  it("should return 200", async () => {
    console.log(webserver.origin);
    const response = await fetch(`${webserver.origin}/v1/status`);
    expect(response.status).toBe(200);

    const responseBody = statusSchema.parse(await response.json());
    const parsedUpdatedAt = new Date(responseBody.updated_at).toISOString();

    expect(responseBody.updated_at).toEqual(parsedUpdatedAt);
    expect(responseBody.dependencies.database.version).toEqual("18.4");
    expect(responseBody.dependencies.database.max_connections).toEqual(100);
    expect(responseBody.dependencies.database.opened_connections).toEqual(1);
  });
});
