import { resolverTenant } from "infra/tenant/resolver";
import { describe, expect, it } from "vitest";

const multi = { modo: "multi" as const, dominioBase: "localhost" };
const producao = { modo: "multi" as const, dominioBase: "filasaude.com.br" };
const single = { modo: "single" as const, dominioBase: "localhost", slugFixo: "pref-a" };

function pelo(host: string | undefined, slugDoCaminho?: string) {
  return { host, slugDoCaminho };
}

describe("resolverTenant", () => {
  describe("PD-15: pelo Host (modo multi)", () => {
    it("subdomínio com porta → slug", () => {
      expect(resolverTenant(pelo("pref-a.localhost:3333"), multi)).toEqual({ slug: "pref-a" });
    });

    it("subdomínio sem porta → slug", () => {
      expect(resolverTenant(pelo("pref-a.localhost"), multi)).toEqual({ slug: "pref-a" });
    });

    it("domínio de produção → slug", () => {
      expect(resolverTenant(pelo("pref-a.filasaude.com.br"), producao)).toEqual({ slug: "pref-a" });
      expect(resolverTenant(pelo("pref-a.filasaude.com.br:443"), producao)).toEqual({ slug: "pref-a" });
    });

    it("maiúsculas no Host não mudam o resultado", () => {
      expect(resolverTenant(pelo("PREF-A.LocalHost:3333"), multi)).toEqual({ slug: "pref-a" });
      expect(resolverTenant(pelo("Pref-A.FilaSaude.com.br"), producao)).toEqual({ slug: "pref-a" });
    });

    it("ponto final do FQDN é aceito", () => {
      expect(resolverTenant(pelo("pref-a.localhost.:3333"), multi)).toEqual({ slug: "pref-a" });
    });

    it("host raiz (com e sem porta) → sem_tenant", () => {
      expect(resolverTenant(pelo("localhost:3333"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("filasaude.com.br"), producao)).toEqual({ erro: "sem_tenant" });
    });

    it("subdomínio duplo → sem_tenant", () => {
      expect(resolverTenant(pelo("a.b.localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("pref-a.x.filasaude.com.br"), producao)).toEqual({ erro: "sem_tenant" });
    });

    it("IP → sem_tenant", () => {
      expect(resolverTenant(pelo("127.0.0.1:3333"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("[::1]:3333"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("10.0.0.1"), producao)).toEqual({ erro: "sem_tenant" });
    });

    it("outro domínio que só termina igual → sem_tenant", () => {
      expect(resolverTenant(pelo("pref-a.evil-localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("pref-a.naofilasaude.com.br"), producao)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("filasaude.com.br.evil.com"), producao)).toEqual({ erro: "sem_tenant" });
    });

    it("subdomínio fora do formato de slug → sem_tenant", () => {
      expect(resolverTenant(pelo("ab.localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("pref_a.localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("1pref.localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo("pref-.localhost"), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo(".localhost"), multi)).toEqual({ erro: "sem_tenant" });
    });

    it("sem Host → sem_tenant", () => {
      expect(resolverTenant(pelo(undefined), multi)).toEqual({ erro: "sem_tenant" });
      expect(resolverTenant(pelo(""), multi)).toEqual({ erro: "sem_tenant" });
    });
  });

  describe("PD-15: pelo caminho e divergência", () => {
    it("só o caminho → slug do caminho", () => {
      expect(resolverTenant(pelo("localhost:3333", "pref-a"), multi)).toEqual({ slug: "pref-a" });
    });

    it("Host e caminho iguais → slug", () => {
      expect(resolverTenant(pelo("pref-a.localhost:3333", "pref-a"), multi)).toEqual({ slug: "pref-a" });
    });

    it("Host e caminho diferentes → municipio_divergente", () => {
      expect(resolverTenant(pelo("pref-a.localhost:3333", "pref-b"), multi)).toEqual({
        erro: "municipio_divergente",
      });
    });

    it("caminho fora do formato de slug, sem Host de tenant → sem_tenant", () => {
      expect(resolverTenant(pelo("localhost:3333", "Pref_A"), multi)).toEqual({ erro: "sem_tenant" });
    });

    it("caminho fora do formato com Host de tenant → municipio_divergente", () => {
      expect(resolverTenant(pelo("pref-a.localhost:3333", "PREF-A"), multi)).toEqual({
        erro: "municipio_divergente",
      });
    });
  });

  describe("PD-12/PD-15: modo single", () => {
    it("usa o slug fixo e ignora o Host", () => {
      expect(resolverTenant(pelo("localhost:3333"), single)).toEqual({ slug: "pref-a" });
      expect(resolverTenant(pelo("pref-b.localhost:3333"), single)).toEqual({ slug: "pref-a" });
      expect(resolverTenant(pelo(undefined), single)).toEqual({ slug: "pref-a" });
    });

    it("caminho igual ao slug fixo → slug", () => {
      expect(resolverTenant(pelo("fila.prefeitura.gov.br", "pref-a"), single)).toEqual({ slug: "pref-a" });
    });

    it("caminho diferente do slug fixo → municipio_divergente", () => {
      expect(resolverTenant(pelo("fila.prefeitura.gov.br", "pref-b"), single)).toEqual({
        erro: "municipio_divergente",
      });
    });

    it("sem slug fixo → sem_tenant", () => {
      expect(resolverTenant(pelo("pref-a.localhost"), { modo: "single", dominioBase: "localhost" })).toEqual({
        erro: "sem_tenant",
      });
    });
  });
});
