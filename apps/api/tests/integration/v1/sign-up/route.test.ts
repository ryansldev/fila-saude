import webserver from "infra/webserver";
import { describe, expect, it } from "vitest";

describe("sign up routes", () => {
  describe("POST /v1/sign-up", () => {
    it("should sign up a new user", async () => {
      const response = await fetch(`${webserver.origin}/v1/sign-up`, {
        method: "POST",
        body: JSON.stringify({ name: "John Doe", email: "john.doe@example.com", password: "password" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(201);
    });
  });
});
