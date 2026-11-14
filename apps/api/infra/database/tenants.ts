import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { LRUCache } from "lru-cache";
import { Pool } from "pg";
import env from "../env";
import { municipio } from "./central/schema/municipio";
import type { Db } from "./index";
import * as auditoria from "./municipal/schema/auditoria";
import * as auth from "./municipal/schema/auth";
import * as aviso from "./municipal/schema/aviso";
import * as diaSessao from "./municipal/schema/dia-sessao";
import * as entrada from "./municipal/schema/entrada";
import * as equipe from "./municipal/schema/equipe";
import * as estacao from "./municipal/schema/estacao";
import * as pessoaLocal from "./municipal/schema/pessoa-local";
import * as servico from "./municipal/schema/servico";
import * as sessao from "./municipal/schema/sessao";
import * as tv from "./municipal/schema/tv";
import * as unidade from "./municipal/schema/unidade";
import { urlDoBanco } from "./url-do-banco";

export { urlDoBanco } from "./url-do-banco";

export const schemaMunicipal = {
  ...pessoaLocal,
  ...unidade,
  ...servico,
  ...estacao,
  ...sessao,
  ...entrada,
  ...diaSessao,
  ...auth,
  ...equipe,
  ...auditoria,
  ...tv,
  ...aviso,
};

export type DbDoTenant = NodePgDatabase<typeof schemaMunicipal> & { $client: Pool };
export type TxDoTenant = Parameters<Parameters<DbDoTenant["transaction"]>[0]>[0];
/** Banco ou transação do tenant: as funções de infra aceitam os dois. */
export type BancoDoTenant = DbDoTenant | TxDoTenant;

// `municipioId` é o id do município no central; null no modo single (PD-12), que não lê o central.
export type Tenant = { slug: string; municipioId: string | null; fuso: string; db: DbDoTenant };

// O que o plugin do tenant precisa: dado o slug resolvido, o tenant ativo (ou null) e o encerramento.
export interface FonteDosTenants {
  obter(slug: string): Promise<Tenant | null>;
  encerrar(): Promise<void>;
}

type LinhaDoCatalogo = { id: string; fuso: string; bancoRef: string; status: "criando" | "ativo" | "suspenso" };

// `false` marca "slug sem município" no cache (o LRUCache não guarda null/undefined).
type EntradaDoCatalogo = LinhaDoCatalogo | false;

export type OpcoesDosPools = {
  max: number;
  conexoesPorTenant: number;
  central: Db;
  ttlCatalogoMs: number;
  // Padrão: TENANT_DATABASE_URL_TEMPLATE e process.env (PD-14).
  template?: string;
  env?: Record<string, string | undefined>;
  // Padrão: console.error. Recebe falhas de conexão e de encerramento dos pools.
  registrar?: (mensagem: string, erro: unknown) => void;
};

// T1.7 / PD-03 / PD-14: um pool `pg` (e uma instância Drizzle) por município, num LRU de no máximo `max`.
// O tenant menos usado sai quando chega o `max + 1`-ésimo, e o pool dele é encerrado (`pool.end()`).
// O catálogo (slug → linha de `municipio`) fica em cache por `ttlCatalogoMs`: suspender um município
// passa a valer depois desse prazo. Com `ttlCatalogoMs` 0 o central é consultado a cada `obter`.
export class PoolsDosTenants implements FonteDosTenants {
  private readonly opcoes: OpcoesDosPools;
  private readonly pools: LRUCache<string, Tenant>;
  private readonly catalogo: LRUCache<string, EntradaDoCatalogo> | null;
  private readonly encerrando = new Set<Promise<void>>();

  constructor(opcoes: OpcoesDosPools) {
    this.opcoes = opcoes;
    this.pools = new LRUCache<string, Tenant>({
      max: opcoes.max,
      dispose: (tenant) => {
        // Um end() que falha só é registrado: não vira rejeição solta nem impede os outros de fechar.
        const fim = tenant.db.$client
          .end()
          .catch((erro) => this.registrar(`falha ao encerrar o pool de ${tenant.slug}`, erro))
          .finally(() => this.encerrando.delete(fim));
        this.encerrando.add(fim);
      },
    });
    this.catalogo =
      opcoes.ttlCatalogoMs > 0
        ? new LRUCache<string, EntradaDoCatalogo>({ max: 10_000, ttl: opcoes.ttlCatalogoMs })
        : null;
  }

  async obter(slug: string): Promise<Tenant | null> {
    const linha = await this.buscarNoCatalogo(slug);
    if (linha?.status !== "ativo") {
      // Município suspenso (ou que sumiu) não mantém conexão aberta.
      this.pools.delete(slug);
      return null;
    }

    const existente = this.pools.get(slug);
    if (existente && existente.municipioId === linha.id) return existente;

    // Daqui até o `set` nada é assíncrono: duas chamadas simultâneas não criam dois pools.
    const url = urlDoBanco(linha.bancoRef, {
      template: this.opcoes.template ?? env.TENANT_DATABASE_URL_TEMPLATE,
      env: this.opcoes.env ?? process.env,
    });
    const pool = new Pool({ connectionString: url, max: this.opcoes.conexoesPorTenant });
    const tenant: Tenant = {
      slug,
      municipioId: linha.id,
      fuso: linha.fuso,
      db: drizzle(pool, { schema: schemaMunicipal }),
    };
    // Cliente ocioso que cai (banco reiniciado, conexão derrubada) emite 'error' no pool; sem ouvinte,
    // isso derrubaria o processo inteiro. Registra e tira o pool do LRU: o próximo `obter` cria outro.
    pool.on("error", (erro) => {
      this.registrar(`conexão do pool de ${slug} caiu`, erro);
      if (this.pools.peek(slug) === tenant) this.pools.delete(slug);
    });
    this.pools.set(slug, tenant);
    return tenant;
  }

  async encerrar(): Promise<void> {
    this.pools.clear();
    this.catalogo?.clear();
    await Promise.allSettled([...this.encerrando]);
  }

  private registrar(mensagem: string, erro: unknown) {
    (this.opcoes.registrar ?? console.error)(mensagem, erro);
  }

  private async buscarNoCatalogo(slug: string): Promise<LinhaDoCatalogo | null> {
    const emCache = this.catalogo?.get(slug);
    if (emCache !== undefined) return emCache || null;

    const [linha] = await this.opcoes.central
      .select({ id: municipio.id, fuso: municipio.fuso, bancoRef: municipio.bancoRef, status: municipio.status })
      .from(municipio)
      .where(eq(municipio.slug, slug));
    this.catalogo?.set(slug, linha ?? false);
    return linha ?? null;
  }
}

export type OpcoesDaFonte = OpcoesDosPools & {
  modo: "multi" | "single";
  // Só no modo single (PD-12): o município fixo, a URL do banco dele e o fuso.
  slugFixo?: string;
  urlFixa?: string;
  fuso: string;
};

// PD-12 / PD-15: modo multi lê o catálogo do central; modo single atende só `slugFixo`, no banco
// `urlFixa`, sem nunca consultar o central (a VPS do município pode nem alcançá-lo).
export function fonteDosTenants(opcoes: OpcoesDaFonte): FonteDosTenants {
  if (opcoes.modo === "multi") return new PoolsDosTenants(opcoes);
  if (!opcoes.slugFixo || !opcoes.urlFixa) {
    throw new Error("modo single exige TENANT_SLUG e TENANT_DATABASE_URL");
  }
  return new TenantFixo({
    slug: opcoes.slugFixo,
    url: opcoes.urlFixa,
    fuso: opcoes.fuso,
    conexoes: opcoes.conexoesPorTenant,
    registrar: opcoes.registrar ?? console.error,
  });
}

// PD-12: o único município de uma VPS em modo single. O pool é criado na primeira requisição e só
// encerrado com o app; `municipioId` fica null porque o id mora no central, que não é consultado.
export class TenantFixo implements FonteDosTenants {
  private tenant: Tenant | null = null;

  constructor(
    private readonly opcoes: {
      slug: string;
      url: string;
      fuso: string;
      conexoes: number;
      registrar: (mensagem: string, erro: unknown) => void;
    },
  ) {}

  async obter(slug: string): Promise<Tenant | null> {
    if (slug !== this.opcoes.slug) return null;
    if (this.tenant) return this.tenant;

    const pool = new Pool({ connectionString: this.opcoes.url, max: this.opcoes.conexoes });
    // Sem ouvinte, um cliente ocioso que cai derrubaria o processo; o pool se recompõe sozinho.
    pool.on("error", (erro) => this.opcoes.registrar(`conexão do pool de ${slug} caiu`, erro));
    this.tenant = { slug, municipioId: null, fuso: this.opcoes.fuso, db: drizzle(pool, { schema: schemaMunicipal }) };
    return this.tenant;
  }

  async encerrar(): Promise<void> {
    const tenant = this.tenant;
    this.tenant = null;
    await tenant?.db.$client
      .end()
      .catch((erro) => this.opcoes.registrar(`falha ao encerrar o pool de ${tenant.slug}`, erro));
  }
}
