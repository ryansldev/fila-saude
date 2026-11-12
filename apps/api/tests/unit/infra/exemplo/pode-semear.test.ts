import { podeSemear } from "infra/exemplo/pode-semear";
import { describe, expect, it } from "vitest";

describe("podeSemear", () => {
  it("PD-40: só development e multi", () => {
    expect(podeSemear({ NODE_ENV: "development", TENANT_MODE: "multi" })).toBe(true);
    expect(podeSemear({ NODE_ENV: "production", TENANT_MODE: "multi" })).toBe(false);
    expect(podeSemear({ NODE_ENV: "test", TENANT_MODE: "multi" })).toBe(false);
    expect(podeSemear({ NODE_ENV: "development", TENANT_MODE: "single" })).toBe(false);
  });
});
