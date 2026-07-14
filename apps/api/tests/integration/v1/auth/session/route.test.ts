import { GetSessionResponseSchema, SignUpResponseSchema } from "@fila-saude/schemas/auth";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /v1/auth/session", () => {
  it("should return the current session", async () => {
    const responseSignUp = await fetch(`${webserver.origin}/v1/auth/sign-up`, {
      method: "POST",
      body: JSON.stringify({
        name: "John Doe",
        email: "john.doe@example.com",
        password: "password",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const session = SignUpResponseSchema.parse(await responseSignUp.json());

    const response = await fetch(`${webserver.origin}/v1/auth/session`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: responseSignUp.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
      },
    });

    expect(response.status).toBe(200);

    const responseBody = await response.json();
    const parsedResponseBody = GetSessionResponseSchema.parse(responseBody);

    expect(parsedResponseBody?.session).toBeDefined();
    expect(parsedResponseBody?.user?.email).toBe("john.doe@example.com");
    expect(parsedResponseBody?.user?.name).toBe("John Doe");
    expect(parsedResponseBody?.user?.id).toBeDefined();

    expect(parsedResponseBody?.session?.token).toBe(session.token);
  });
});
