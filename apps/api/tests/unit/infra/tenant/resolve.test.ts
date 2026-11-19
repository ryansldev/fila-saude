import { resolveTenant } from "infra/tenant/resolve";
import { describe, expect, it } from "vitest";

const multi = { mode: "multi" as const, domainBase: "localhost" };
const production = { mode: "multi" as const, domainBase: "filasaude.com.br" };
const single = { mode: "single" as const, domainBase: "localhost", fixedSlug: "pref-a" };
const homolog = { mode: "multi" as const, domainBase: "homolog.filasaude.com.br" };

function by(host: string | undefined, pathSlug?: string) {
  return { host, pathSlug };
}

describe("resolveTenant", () => {
  describe("PD-15: pelo Host (modo multi)", () => {
    it("subdomínio com porta → slug", () => {
      expect(resolveTenant(by("pref-a.localhost:3333"), multi)).toEqual({ slug: "pref-a" });
    });

    it("subdomínio sem porta → slug", () => {
      expect(resolveTenant(by("pref-a.localhost"), multi)).toEqual({ slug: "pref-a" });
    });

    it("domínio de produção → slug", () => {
      expect(resolveTenant(by("pref-a.filasaude.com.br"), production)).toEqual({ slug: "pref-a" });
      expect(resolveTenant(by("pref-a.filasaude.com.br:443"), production)).toEqual({ slug: "pref-a" });
    });

    it("AD-069: `api.` é o host da central, não um município: o município vem do caminho", () => {
      expect(resolveTenant(by("api.filasaude.com.br", "pref-a"), production)).toEqual({ slug: "pref-a" });
      expect(resolveTenant(by("api.filasaude.com.br"), production)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("www.filasaude.com.br"), production)).toEqual({ error: "no_tenant" });
    });

    it("AD-069: nome reservado só vale para o Host; pelo caminho e no modo single, resolve normalmente", () => {
      expect(resolveTenant(by(undefined, "admin"), production)).toEqual({ slug: "admin" });
      expect(
        resolveTenant(by("x.prefeitura.gov.br"), { mode: "single", domainBase: "localhost", fixedSlug: "admin" }),
      ).toEqual({ slug: "admin" });
    });

    it("AD-069: a homologação, com o domínio base `homolog.filasaude.com.br`, segue o mesmo desenho", () => {
      expect(resolveTenant(by("pref-a.homolog.filasaude.com.br"), homolog)).toEqual({ slug: "pref-a" });
      expect(resolveTenant(by("api.homolog.filasaude.com.br", "pref-a"), homolog)).toEqual({ slug: "pref-a" });
    });

    it("maiúsculas no Host não mudam o resultado", () => {
      expect(resolveTenant(by("PREF-A.LocalHost:3333"), multi)).toEqual({ slug: "pref-a" });
      expect(resolveTenant(by("Pref-A.FilaSaude.com.br"), production)).toEqual({ slug: "pref-a" });
    });

    it("ponto final do FQDN é aceito", () => {
      expect(resolveTenant(by("pref-a.localhost.:3333"), multi)).toEqual({ slug: "pref-a" });
    });

    it("host raiz (com e sem porta) → sem_tenant", () => {
      expect(resolveTenant(by("localhost:3333"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("filasaude.com.br"), production)).toEqual({ error: "no_tenant" });
    });

    it("subdomínio duplo → sem_tenant", () => {
      expect(resolveTenant(by("a.b.localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("pref-a.x.filasaude.com.br"), production)).toEqual({ error: "no_tenant" });
    });

    it("IP → sem_tenant", () => {
      expect(resolveTenant(by("127.0.0.1:3333"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("[::1]:3333"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("10.0.0.1"), production)).toEqual({ error: "no_tenant" });
    });

    it("outro domínio que só termina igual → sem_tenant", () => {
      expect(resolveTenant(by("pref-a.evil-localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("pref-a.naofilasaude.com.br"), production)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("filasaude.com.br.evil.com"), production)).toEqual({ error: "no_tenant" });
    });

    it("subdomínio fora do formato de slug → sem_tenant", () => {
      expect(resolveTenant(by("ab.localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("pref_a.localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("1pref.localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("pref-.localhost"), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by(".localhost"), multi)).toEqual({ error: "no_tenant" });
    });

    it("sem Host → sem_tenant", () => {
      expect(resolveTenant(by(undefined), multi)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by(""), multi)).toEqual({ error: "no_tenant" });
    });
  });

  describe("PD-15: pelo caminho e divergência", () => {
    it("só o caminho → slug do caminho", () => {
      expect(resolveTenant(by("localhost:3333", "pref-a"), multi)).toEqual({ slug: "pref-a" });
    });

    it("Host e caminho iguais → slug", () => {
      expect(resolveTenant(by("pref-a.localhost:3333", "pref-a"), multi)).toEqual({ slug: "pref-a" });
    });

    it("Host e caminho diferentes → municipio_divergente", () => {
      expect(resolveTenant(by("pref-a.localhost:3333", "pref-b"), multi)).toEqual({
        error: "municipality_mismatch",
      });
    });

    it("caminho fora do formato de slug, sem Host de tenant → sem_tenant", () => {
      expect(resolveTenant(by("localhost:3333", "Pref_A"), multi)).toEqual({ error: "no_tenant" });
    });

    it("caminho fora do formato com Host de tenant → municipio_divergente", () => {
      expect(resolveTenant(by("pref-a.localhost:3333", "PREF-A"), multi)).toEqual({
        error: "municipality_mismatch",
      });
    });
  });

  describe("PD-12/PD-15: modo single", () => {
    it("usa o slug fixo e ignora o Host", () => {
      expect(resolveTenant(by("localhost:3333"), single)).toEqual({ slug: "pref-a" });
      expect(resolveTenant(by("pref-b.localhost:3333"), single)).toEqual({ slug: "pref-a" });
      expect(resolveTenant(by(undefined), single)).toEqual({ slug: "pref-a" });
    });

    it("caminho igual ao slug fixo → slug", () => {
      expect(resolveTenant(by("fila.prefeitura.gov.br", "pref-a"), single)).toEqual({ slug: "pref-a" });
    });

    it("caminho com outro slug → sem_tenant (404: a VPS só conhece o próprio município)", () => {
      expect(resolveTenant(by("fila.prefeitura.gov.br", "pref-b"), single)).toEqual({ error: "no_tenant" });
      expect(resolveTenant(by("pref-b.localhost:3333", "pref-b"), single)).toEqual({ error: "no_tenant" });
    });

    it("sem slug fixo → sem_tenant", () => {
      expect(resolveTenant(by("pref-a.localhost"), { mode: "single", domainBase: "localhost" })).toEqual({
        error: "no_tenant",
      });
    });
  });
});
