import { describe, expect, it } from "vitest";
import { destinoDoProxy, slugDoHost, urlDaApi } from "@/lib/tenant";

describe("slugDoHost", () => {
  it("PD-09: subdomínio com porta → slug", () => {
    expect(slugDoHost("pref-a.localhost:3000", "localhost")).toBe("pref-a");
  });

  it("PD-09: subdomínio sem porta → slug", () => {
    expect(slugDoHost("pref-a.filasaude.com.br", "filasaude.com.br")).toBe("pref-a");
  });

  it("PD-09: host em maiúsculas é normalizado", () => {
    expect(slugDoHost("Pref-A.LocalHost:3000", "localhost")).toBe("pref-a");
  });

  it("PD-09: domínio raiz, com e sem porta → null", () => {
    expect(slugDoHost("localhost:3000", "localhost")).toBeNull();
    expect(slugDoHost("localhost", "localhost")).toBeNull();
    expect(slugDoHost("filasaude.com.br", "filasaude.com.br")).toBeNull();
  });

  it("PD-09: subdomínio duplo → null", () => {
    expect(slugDoHost("a.b.localhost:3000", "localhost")).toBeNull();
    expect(slugDoHost("a.b.filasaude.com.br", "filasaude.com.br")).toBeNull();
  });

  it("PD-09: host de outro domínio → null", () => {
    expect(slugDoHost("pref-a.outro.com", "filasaude.com.br")).toBeNull();
    expect(slugDoHost("pref-alocalhost:3000", "localhost")).toBeNull();
  });

  it("PD-09: host vazio ou rótulo inválido → null", () => {
    expect(slugDoHost("", "localhost")).toBeNull();
    expect(slugDoHost(".localhost:3000", "localhost")).toBeNull();
    expect(slugDoHost("pref_a.localhost", "localhost")).toBeNull();
  });

  it("PD-09: slug segue a regra da API (2 a 30 caracteres, começa com letra, sem hífen no fim)", () => {
    expect(slugDoHost("ab.localhost", "localhost")).toBe("ab");
    expect(slugDoHost("a.localhost", "localhost")).toBeNull();
    expect(slugDoHost("1abc.localhost", "localhost")).toBeNull();
    expect(slugDoHost("-abc.localhost", "localhost")).toBeNull();
    expect(slugDoHost("abc-.localhost", "localhost")).toBeNull();
    expect(slugDoHost(`${"a".repeat(30)}.localhost`, "localhost")).toBe("a".repeat(30));
    expect(slugDoHost(`${"a".repeat(31)}.localhost`, "localhost")).toBeNull();
  });
});

describe("urlDaApi", () => {
  it("PD-24: em dev (porta configurada) chama o mesmo host na porta da API", () => {
    expect(urlDaApi({ protocol: "http:", hostname: "pref-a.localhost" }, { NEXT_PUBLIC_API_PORTA: "3333" })).toBe(
      "http://pref-a.localhost:3333",
    );
  });

  it("PD-24: em produção (sem porta) usa a mesma origem", () => {
    expect(urlDaApi({ protocol: "https:", hostname: "pref-a.filasaude.com.br" }, {})).toBe("");
    expect(urlDaApi({ protocol: "https:", hostname: "pref-a.filasaude.com.br" }, { NEXT_PUBLIC_API_PORTA: "" })).toBe(
      "",
    );
  });
});

describe("destinoDoProxy", () => {
  it("PD-09: sem slug no host → página de município não encontrado", () => {
    expect(destinoDoProxy("localhost:3000", "localhost")).toEqual({ tipo: "municipio_nao_encontrado" });
  });

  it("PD-09: com slug → segue com o slug", () => {
    expect(destinoDoProxy("pref-a.localhost:3000", "localhost")).toEqual({ tipo: "segue", slug: "pref-a" });
  });

  it("PD-09: sem Host → município não encontrado", () => {
    expect(destinoDoProxy(null, "localhost")).toEqual({ tipo: "municipio_nao_encontrado" });
  });
});
