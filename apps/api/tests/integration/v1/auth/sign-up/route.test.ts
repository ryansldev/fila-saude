import { SignUpResponseSchema } from "@fila-saude/schemas/auth";
import { ErrorResponseSchema } from "@fila-saude/schemas/common";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("sign up routes", () => {
  describe("POST /v1/sign-up", () => {
    it("should sign up a new user", async () => {
      const response = await fetch(`${webserver.origin}/v1/auth/sign-up`, {
        method: "POST",
        body: JSON.stringify({ name: "John Doe", email: "john.doe@example.com", password: "password" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseBody = SignUpResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(responseBody?.token).toBeDefined();
      expect(responseBody?.user?.email).toBe("john.doe@example.com");
      expect(responseBody?.user?.name).toBe("John Doe");
      expect(responseBody?.user?.id).toBeDefined();
      expect(responseBody?.user?.email_verified).toBe(false);

      const cookies = response.headers.getSetCookie();

      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((cookie) => cookie.includes("better-auth.session_token"))).toBe(true);

      const authCookie = cookies.find((cookie) => cookie.includes("better-auth.session_token"));
      expect(authCookie).include(`better-auth.session_token=${responseBody.token}`);
    });

    it("should return a 422 if the email is already in use", async () => {
      const response = await fetch(`${webserver.origin}/v1/auth/sign-up`, {
        method: "POST",
        body: JSON.stringify({ name: "John Doe", email: "john.doe@example.com", password: "password" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(422);
      const responseBody = ErrorResponseSchema.parse(await response.json());

      expect(responseBody?.message).toEqual("Unprocessable Entity");
      expect(responseBody?.status).toEqual(422);
      expect(responseBody?.error).toEqual("User already exists. Use another email.");
    });

    it("should return a 400 if the email is invalid", async () => {
      const response = await fetch(`${webserver.origin}/v1/auth/sign-up`, {
        method: "POST",
        body: JSON.stringify({ name: "John Doe", email: "invalid-email", password: "password" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(400);
      const responseBody = ErrorResponseSchema.parse(await response.json());

      expect(responseBody?.message).toEqual("Bad Request");
      expect(responseBody?.status).toEqual(400);
      expect(responseBody?.error).toEqual("Invalid email address");
    });
  });
});
