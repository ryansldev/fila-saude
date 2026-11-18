import { describe, expect, it } from "vitest";
import { apiUrl, hostSlug, proxyDestination } from "@/lib/tenant";

describe("hostSlug", () => {
  it("PD-09: subdomínio com porta → slug", () => {
    expect(hostSlug("pref-a.localhost:3000", "localhost")).toBe("pref-a");
  });

  it("PD-09: subdomínio sem porta → slug", () => {
    expect(hostSlug("pref-a.filasaude.com.br", "filasaude.com.br")).toBe("pref-a");
  });

  it("PD-09: host em maiúsculas é normalizado", () => {
    expect(hostSlug("Pref-A.LocalHost:3000", "localhost")).toBe("pref-a");
  });

  it("PD-09: domínio raiz, com e sem porta → null", () => {
    expect(hostSlug("localhost:3000", "localhost")).toBeNull();
    expect(hostSlug("localhost", "localhost")).toBeNull();
    expect(hostSlug("filasaude.com.br", "filasaude.com.br")).toBeNull();
  });

  it("PD-09: subdomínio duplo → null", () => {
    expect(hostSlug("a.b.localhost:3000", "localhost")).toBeNull();
    expect(hostSlug("a.b.filasaude.com.br", "filasaude.com.br")).toBeNull();
  });

  it("PD-09: host de outro domínio → null", () => {
    expect(hostSlug("pref-a.outro.com", "filasaude.com.br")).toBeNull();
    expect(hostSlug("pref-alocalhost:3000", "localhost")).toBeNull();
  });

  it("PD-09: host vazio ou rótulo inválido → null", () => {
    expect(hostSlug("", "localhost")).toBeNull();
    expect(hostSlug(".localhost:3000", "localhost")).toBeNull();
    expect(hostSlug("pref_a.localhost", "localhost")).toBeNull();
  });

  it("PD-09: slug segue a regra da API (3 a 30 caracteres, começa com letra, sem hífen no fim)", () => {
    expect(hostSlug("abc.localhost", "localhost")).toBe("abc");
    expect(hostSlug("ab.localhost", "localhost")).toBeNull();
    expect(hostSlug("a.localhost", "localhost")).toBeNull();
    expect(hostSlug("1abc.localhost", "localhost")).toBeNull();
    expect(hostSlug("-abc.localhost", "localhost")).toBeNull();
    expect(hostSlug("abc-.localhost", "localhost")).toBeNull();
    expect(hostSlug(`${"a".repeat(30)}.localhost`, "localhost")).toBe("a".repeat(30));
    expect(hostSlug(`${"a".repeat(31)}.localhost`, "localhost")).toBeNull();
  });
});

describe("apiUrl", () => {
  it("PD-24: em dev (porta configurada) chama o mesmo host na porta da API", () => {
    expect(apiUrl({ protocol: "http:", hostname: "pref-a.localhost" }, { NEXT_PUBLIC_API_PORT: "3333" })).toBe(
      "http://pref-a.localhost:3333",
    );
  });

  it("PD-24: em produção (sem porta) usa a mesma origem", () => {
    expect(apiUrl({ protocol: "https:", hostname: "pref-a.filasaude.com.br" }, {})).toBe("");
    expect(apiUrl({ protocol: "https:", hostname: "pref-a.filasaude.com.br" }, { NEXT_PUBLIC_API_PORT: "" })).toBe("");
  });
});

describe("proxyDestination", () => {
  it("PD-09: sem slug no host → página de município não encontrado", () => {
    expect(proxyDestination("localhost:3000", "localhost")).toEqual({ kind: "municipality_not_found" });
  });

  it("PD-09: com slug → segue com o slug", () => {
    expect(proxyDestination("pref-a.localhost:3000", "localhost")).toEqual({ kind: "continues", slug: "pref-a" });
  });

  it("PD-09: sem Host → município não encontrado", () => {
    expect(proxyDestination(null, "localhost")).toEqual({ kind: "municipality_not_found" });
  });
});
