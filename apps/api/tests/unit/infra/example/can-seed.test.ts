import { canSeed } from "infra/example/can-seed";
import { describe, expect, it } from "vitest";

describe("canSeed", () => {
  it("PD-40: só development e multi", () => {
    expect(canSeed({ NODE_ENV: "development", TENANT_MODE: "multi" })).toBe(true);
    expect(canSeed({ NODE_ENV: "production", TENANT_MODE: "multi" })).toBe(false);
    expect(canSeed({ NODE_ENV: "test", TENANT_MODE: "multi" })).toBe(false);
    expect(canSeed({ NODE_ENV: "development", TENANT_MODE: "single" })).toBe(false);
  });
});
