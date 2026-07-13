import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /v1/auth/sign-out", () => {
  it("should sign out a user and return a 200 status code", async () => {
    const response = await fetch(`${webserver.origin}/v1/auth/sign-out`, {
      method: "POST",
    });

    expect(response.status).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({ success: true });
  });
});
