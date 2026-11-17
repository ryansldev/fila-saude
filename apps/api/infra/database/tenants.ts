import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { LRUCache } from "lru-cache";
import { Pool } from "pg";
import env from "../env";
import { municipality } from "./central/schema/municipality";
import { databaseUrl } from "./database-url";
import type { Db } from "./index";
import * as audit from "./municipal/schema/audit";
import * as auth from "./municipal/schema/auth";
import * as entry from "./municipal/schema/entry";
import * as localPerson from "./municipal/schema/local-person";
import * as notice from "./municipal/schema/notice";
import * as service from "./municipal/schema/service";
import * as session from "./municipal/schema/session";
import * as sessionDay from "./municipal/schema/session-day";
import * as staff from "./municipal/schema/staff";
import * as station from "./municipal/schema/station";
import * as tv from "./municipal/schema/tv";
import * as unit from "./municipal/schema/unit";

export { databaseUrl } from "./database-url";

export const schemaMunicipal = {
  ...localPerson,
  ...unit,
  ...service,
  ...station,
  ...session,
  ...entry,
  ...sessionDay,
  ...auth,
  ...staff,
  ...audit,
  ...tv,
  ...notice,
};

export type TenantDb = NodePgDatabase<typeof schemaMunicipal> & { $client: Pool };
export type TenantTx = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];
/** Banco ou transação do tenant: as funções de infra aceitam os dois. */
export type TenantDatabase = TenantDb | TenantTx;

// `municipalityId` é o id do município no central; null no modo single (PD-12), que não lê o central.
export type Tenant = { slug: string; municipalityId: string | null; timeZone: string; db: TenantDb };

// O que o plugin do tenant precisa: dado o slug resolvido, o tenant ativo (ou null) e o encerramento.
export interface TenantSource {
  get(slug: string): Promise<Tenant | null>;
  close(): Promise<void>;
}

type CatalogRow = { id: string; timeZone: string; databaseRef: string; status: "creating" | "active" | "suspended" };

// `false` marca "slug sem município" no cache (o LRUCache não guarda null/undefined).
type CatalogEntry = CatalogRow | false;

export type PoolsOptions = {
  max: number;
  connectionsByTenant: number;
  central: Db;
  ttlCatalogMs: number;
  // Padrão: TENANT_DATABASE_URL_TEMPLATE e process.env (PD-14).
  template?: string;
  env?: Record<string, string | undefined>;
  // Padrão: console.error. Recebe falhas de conexão e de encerramento dos pools.
  register?: (message: string, error: unknown) => void;
};

// T1.7 / PD-03 / PD-14: um pool `pg` (e uma instância Drizzle) por município, num LRU de no máximo `max`.
// O tenant menos usado sai quando chega o `max + 1`-ésimo, e o pool dele é encerrado (`pool.end()`).
// O catálogo (slug → linha de `municipio`) fica em cache por `ttlCatalogMs`: suspender um município
// passa a valer depois desse prazo. Com `ttlCatalogMs` 0 o central é consultado a cada `obter`.
export class TenantsPools implements TenantSource {
  private readonly options: PoolsOptions;
  private readonly pools: LRUCache<string, Tenant>;
  private readonly catalog: LRUCache<string, CatalogEntry> | null;
  private readonly closing = new Set<Promise<void>>();

  constructor(options: PoolsOptions) {
    this.options = options;
    this.pools = new LRUCache<string, Tenant>({
      max: options.max,
      dispose: (tenant) => {
        // Um end() que falha só é registrado: não vira rejeição solta nem impede os outros de fechar.
        const end = tenant.db.$client
          .end()
          .catch((error) => this.register(`falha ao encerrar o pool de ${tenant.slug}`, error))
          .finally(() => this.closing.delete(end));
        this.closing.add(end);
      },
    });
    this.catalog =
      options.ttlCatalogMs > 0 ? new LRUCache<string, CatalogEntry>({ max: 10_000, ttl: options.ttlCatalogMs }) : null;
  }

  async get(slug: string): Promise<Tenant | null> {
    const row = await this.fetchCatalog(slug);
    if (row?.status !== "active") {
      // Município suspenso (ou que sumiu) não mantém conexão aberta.
      this.pools.delete(slug);
      return null;
    }

    const existing = this.pools.get(slug);
    if (existing && existing.municipalityId === row.id) return existing;

    // Daqui até o `set` nada é assíncrono: duas chamadas simultâneas não criam dois pools.
    const url = databaseUrl(row.databaseRef, {
      template: this.options.template ?? env.TENANT_DATABASE_URL_TEMPLATE,
      env: this.options.env ?? process.env,
    });
    const pool = new Pool({ connectionString: url, max: this.options.connectionsByTenant });
    const tenant: Tenant = {
      slug,
      municipalityId: row.id,
      timeZone: row.timeZone,
      db: drizzle(pool, { schema: schemaMunicipal }),
    };
    // Cliente ocioso que cai (banco reiniciado, conexão derrubada) emite 'error' no pool; sem ouvinte,
    // isso derrubaria o processo inteiro. Registra e tira o pool do LRU: o próximo `obter` cria outro.
    pool.on("error", (error) => {
      this.register(`conexão do pool de ${slug} caiu`, error);
      if (this.pools.peek(slug) === tenant) this.pools.delete(slug);
    });
    this.pools.set(slug, tenant);
    return tenant;
  }

  async close(): Promise<void> {
    this.pools.clear();
    this.catalog?.clear();
    await Promise.allSettled([...this.closing]);
  }

  private register(message: string, error: unknown) {
    (this.options.register ?? console.error)(message, error);
  }

  private async fetchCatalog(slug: string): Promise<CatalogRow | null> {
    const inCache = this.catalog?.get(slug);
    if (inCache !== undefined) return inCache || null;

    const [row] = await this.options.central
      .select({
        id: municipality.id,
        timeZone: municipality.timeZone,
        databaseRef: municipality.databaseRef,
        status: municipality.status,
      })
      .from(municipality)
      .where(eq(municipality.slug, slug));
    this.catalog?.set(slug, row ?? false);
    return row ?? null;
  }
}

export type SourceOptions = PoolsOptions & {
  mode: "multi" | "single";
  // Só no modo single (PD-12): o município fixo, a URL do banco dele e o fuso.
  fixedSlug?: string;
  fixedUrl?: string;
  timeZone: string;
};

// PD-12 / PD-15: modo multi lê o catálogo do central; modo single atende só `fixedSlug`, no banco
// `fixedUrl`, sem nunca consultar o central (a VPS do município pode nem alcançá-lo).
export function tenantSource(options: SourceOptions): TenantSource {
  if (options.mode === "multi") return new TenantsPools(options);
  if (!options.fixedSlug || !options.fixedUrl) {
    throw new Error("modo single exige TENANT_SLUG e TENANT_DATABASE_URL");
  }
  return new FixedTenant({
    slug: options.fixedSlug,
    url: options.fixedUrl,
    timeZone: options.timeZone,
    connections: options.connectionsByTenant,
    register: options.register ?? console.error,
  });
}

// PD-12: o único município de uma VPS em modo single. O pool é criado na primeira requisição e só
// encerrado com o app; `municipalityId` fica null porque o id mora no central, que não é consultado.
export class FixedTenant implements TenantSource {
  private tenant: Tenant | null = null;

  constructor(
    private readonly options: {
      slug: string;
      url: string;
      timeZone: string;
      connections: number;
      register: (message: string, error: unknown) => void;
    },
  ) {}

  async get(slug: string): Promise<Tenant | null> {
    if (slug !== this.options.slug) return null;
    if (this.tenant) return this.tenant;

    const pool = new Pool({ connectionString: this.options.url, max: this.options.connections });
    // Sem ouvinte, um cliente ocioso que cai derrubaria o processo; o pool se recompõe sozinho.
    pool.on("error", (error) => this.options.register(`conexão do pool de ${slug} caiu`, error));
    this.tenant = {
      slug,
      municipalityId: null,
      timeZone: this.options.timeZone,
      db: drizzle(pool, { schema: schemaMunicipal }),
    };
    return this.tenant;
  }

  async close(): Promise<void> {
    const tenant = this.tenant;
    this.tenant = null;
    await tenant?.db.$client
      .end()
      .catch((error) => this.options.register(`falha ao encerrar o pool de ${tenant.slug}`, error));
  }
}
