import { signInResponseSchema } from "@fila-saude/schemas/auth";
import { errorResponseSchema } from "@fila-saude/schemas/common";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /v1/auth/sign-in", () => {
  it("should sign in a user and return a 200 status code", async () => {
    await fetch(`${webserver.origin}/v1/auth/sign-up`, {
      method: "POST",
      body: JSON.stringify({
        email: "john.doe@example.com",
        password: "password",
        name: "John Doe",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    // await fetch(`${webserver.origin}/v1/auth/sign-out`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    // });

    const response = await fetch(`${webserver.origin}/v1/auth/sign-in`, {
      method: "POST",
      body: JSON.stringify({
        email: "john.doe@example.com",
        password: "password",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(200);

    const responseBody = signInResponseSchema.parse(await response.json());

    expect(responseBody).toBeDefined();
    expect(responseBody.token).toBeDefined();
    expect(responseBody.user).toBeDefined();
    expect(responseBody.user.email).toBe("john.doe@example.com");
    expect(responseBody.user.name).toBe("John Doe");
    expect(responseBody.user.id).toBeDefined();
    expect(responseBody.user.created_at).toBeDefined();
    expect(responseBody.user.updated_at).toBeDefined();
    expect(responseBody.user.email_verified).toBe(false);
    expect(responseBody.user.image).toBeNull();
  });

  it("should return a 401 status code if the email or password is incorrect", async () => {
    const response = await fetch(`${webserver.origin}/v1/auth/sign-in`, {
      method: "POST",
      body: JSON.stringify({
        email: "john.doe1@example.com",
        password: "password",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(401);
    const responseBody = errorResponseSchema.parse(await response.json());

    expect(responseBody.status).toEqual(401);
    expect(responseBody.message).toEqual("Unauthorized");
  });

  it("should return a 400 status code if the email is not provided", async () => {
    const response = await fetch(`${webserver.origin}/v1/auth/sign-in`, {
      method: "POST",
      body: JSON.stringify({
        password: "password",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(400);
    const responseBody = errorResponseSchema.parse(await response.json());

    expect(responseBody.status).toEqual(400);
    expect(responseBody.message).toEqual("Bad Request");
  });

  it("should return a 400 status code if the password is not provided", async () => {
    const response = await fetch(`${webserver.origin}/v1/auth/sign-in`, {
      method: "POST",
      body: JSON.stringify({
        email: "john.doe@example.com",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(400);
    const responseBody = errorResponseSchema.parse(await response.json());

    expect(responseBody.status).toEqual(400);
    expect(responseBody.message).toEqual("Bad Request");
  });

  it("should return a 400 status code if the email is not a valid email", async () => {
    const response = await fetch(`${webserver.origin}/v1/auth/sign-in`, {
      method: "POST",
      body: JSON.stringify({
        email: "john.doe.example.com",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(400);
    const responseBody = errorResponseSchema.parse(await response.json());

    expect(responseBody.status).toEqual(400);
    expect(responseBody.message).toEqual("Bad Request");
  });
});
