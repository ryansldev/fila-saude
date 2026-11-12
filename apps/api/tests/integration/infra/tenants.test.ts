import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import { PoolsDosTenants, urlDoBanco } from "infra/database/tenants";
import { bancoDoSlug } from "infra/tenant/slug";
import orchestrator from "tests/orchestrator";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const abertos: PoolsDosTenants[] = [];

function novosPools(opcoes: Partial<ConstructorParameters<typeof PoolsDosTenants>[0]> = {}) {
  const pools = new PoolsDosTenants({ max: 10, conexoesPorTenant: 2, central: database, ttlCatalogoMs: 0, ...opcoes });
  abertos.push(pools);
  return pools;
}

async function municipioSemBanco(status: "criando" | "suspenso") {
  const slug = orchestrator.slugUnico();
  await database
    .insert(municipio)
    .values({ slug, nome: "Sem banco", uf: "SP", bancoRef: `template:${bancoDoSlug(slug)}`, status });
  return slug;
}

describe("PoolsDosTenants", () => {
  afterEach(async () => {
    for (const pools of abertos.splice(0)) await pools.encerrar();
  });

  afterAll(async () => {
    await orchestrator.derrubarMunicipios();
  });

  it("PD-14: urlDoBanco expande template e env, recusa prefixo desconhecido", () => {
    const deps = { template: "postgresql://h:1/{banco}", env: { BANCO_A: "postgresql://a:2/fila_t_a" } };

    expect(urlDoBanco("template:fila_t_x", deps)).toBe("postgresql://h:1/fila_t_x");
    expect(urlDoBanco("env:BANCO_A", deps)).toBe("postgresql://a:2/fila_t_a");
    expect(() => urlDoBanco("env:BANCO_B", deps)).toThrow(/variável de ambiente ausente: BANCO_B/);
    expect(() => urlDoBanco("env:", deps)).toThrow(/sem nome/);
    expect(() => urlDoBanco("template:", deps)).toThrow(/sem nome/);
    expect(() => urlDoBanco("ftp:fila_t_x", deps)).toThrow(/referência de banco desconhecida: ftp:/);
  });

  it("pool: mesmo slug devolve a mesma instância", async () => {
    const { slug, municipioId } = await orchestrator.criarMunicipio({ fuso: "America/Recife" });
    const pools = novosPools();

    const primeiro = await pools.obter(slug);
    const segundo = await pools.obter(slug);

    expect(primeiro).toMatchObject({ slug, municipioId, fuso: "America/Recife" });
    expect(segundo?.db).toBe(primeiro?.db);
    // O pool aponta para o banco do tenant, não para o central.
    const resultado = await primeiro?.db.execute<{ banco: string }>("select current_database() as banco");
    expect(resultado?.rows[0]?.banco).toBe(bancoDoSlug(slug));
  });

  it("pool: com max 2, o terceiro tenant encerra o menos usado", async () => {
    const a = await orchestrator.criarMunicipio();
    const b = await orchestrator.criarMunicipio();
    const c = await orchestrator.criarMunicipio();
    const pools = novosPools({ max: 2 });

    const tenantA = await pools.obter(a.slug);
    const tenantB = await pools.obter(b.slug);
    await tenantB?.db.execute("select 1");
    await pools.obter(a.slug); // A passa a ser o mais recente; B vira o menos usado.
    const tenantC = await pools.obter(c.slug);

    expect(tenantB?.db.$client.ended).toBe(true);
    expect(tenantA?.db.$client.ended).toBe(false);
    expect(tenantC?.db.$client.ended).toBe(false);

    // B volta com um pool novo.
    const deNovo = await pools.obter(b.slug);
    expect(deNovo?.db).not.toBe(tenantB?.db);
    expect(deNovo?.db.$client.ended).toBe(false);
    expect(tenantA?.db.$client.ended).toBe(true);

    await pools.encerrar();
    expect(tenantC?.db.$client.ended).toBe(true);
    expect(deNovo?.db.$client.ended).toBe(true);
  });

  it("pool: slug desconhecido, criando ou suspenso → null", async () => {
    const criando = await municipioSemBanco("criando");
    const suspenso = await municipioSemBanco("suspenso");
    const pools = novosPools();

    expect(await pools.obter(orchestrator.slugUnico())).toBeNull();
    expect(await pools.obter(criando)).toBeNull();
    expect(await pools.obter(suspenso)).toBeNull();
  });

  it("pool: mudança de status no catálogo aparece depois do TTL", async () => {
    const { slug } = await orchestrator.criarMunicipio();
    const pools = novosPools({ ttlCatalogoMs: 200 });

    const ativo = await pools.obter(slug);
    expect(ativo).not.toBeNull();
    await database.update(municipio).set({ status: "suspenso" }).where(eq(municipio.slug, slug));

    expect(await pools.obter(slug)).not.toBeNull(); // ainda no cache do catálogo
    await new Promise((resolver) => setTimeout(resolver, 250));
    expect(await pools.obter(slug)).toBeNull();
    // Suspenso, o pool do tenant é encerrado na hora.
    expect(ativo?.db.$client.ended).toBe(true);
  });
});
