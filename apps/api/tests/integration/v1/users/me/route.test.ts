import { ErrorResponseSchema } from "@fila-saude/schemas/common";
import { UpdateUserResponseSchema } from "@fila-saude/schemas/users";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/users/me", () => {
  it("should return the current user", async () => {
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

    const response = await fetch(`${webserver.origin}/v1/users/me`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "John Doe",
        email: "john.doe@example.com",
        password: "password",
      }),
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
    const parsedResponseBody = UpdateUserResponseSchema.parse(responseBody);

    expect(parsedResponseBody).toMatchObject({ status: true });
  });

  it("should return 401 if the user is not authenticated", async () => {
    const response = await fetch(`${webserver.origin}/v1/users/me`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "John Doe",
        image: "https://example.com/image.png",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(401);
    const responseBody = await response.json();
    const parsedResponseBody = ErrorResponseSchema.parse(responseBody);

    expect(parsedResponseBody.status).toBe(401);
    expect(parsedResponseBody.message).toBe("Unauthorized");
  });

  it("should return 400 if the request body is invalid", async () => {
    const response = await fetch(`${webserver.origin}/v1/users/me`, {
      method: "PATCH",
      body: JSON.stringify({
        name: 123,
        image: "https://example.com/image.png",
      }),
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    const parsedResponseBody = ErrorResponseSchema.parse(responseBody);

    expect(parsedResponseBody.status).toBe(400);
    expect(parsedResponseBody.message).toBe("Bad Request");
  });
});
