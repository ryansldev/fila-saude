import { isReservedSlug, RESERVED_SLUGS, validateSlug } from "infra/tenant/slug";
import { describe, expect, it } from "vitest";

describe("slug", () => {
  it("aceita o formato de slug", () => {
    expect(validateSlug("pref-a")).toBe(true);
    expect(validateSlug("exemplo")).toBe(true);
  });

  it("AD-069: os rótulos reservados (hosts do produto) são marcados, sem mudar o formato", () => {
    expect(RESERVED_SLUGS).toEqual(expect.arrayContaining(["api", "www", "homolog"]));
    for (const slug of RESERVED_SLUGS) {
      expect([slug, isReservedSlug(slug), validateSlug(slug)]).toEqual([slug, true, true]);
    }
    expect(isReservedSlug("pref-a")).toBe(false);
  });
});
