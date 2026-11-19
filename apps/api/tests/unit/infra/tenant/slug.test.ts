import { RESERVED_SLUGS, validateSlug } from "infra/tenant/slug";
import { describe, expect, it } from "vitest";

describe("validateSlug", () => {
  it("aceita o formato de slug", () => {
    expect(validateSlug("pref-a")).toBe(true);
    expect(validateSlug("exemplo")).toBe(true);
  });

  it("AD-069: os rótulos reservados (hosts do produto) nunca são município", () => {
    expect(RESERVED_SLUGS).toEqual(expect.arrayContaining(["api", "www", "homolog"]));
    for (const slug of RESERVED_SLUGS) expect([slug, validateSlug(slug)]).toEqual([slug, false]);
  });
});
