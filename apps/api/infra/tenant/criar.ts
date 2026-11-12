import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { criarUsuarioPainel } from "infra/auth/painel";
import type { Db } from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import { criarBancoSeNaoExiste } from "infra/database/criar-banco";
import { migrarBanco } from "infra/database/migrar";
import { usuarioPainel } from "infra/database/municipal/schema/auth";
import { type DbDoTenant, schemaMunicipal } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { concederPerfis } from "infra/painel/perfis";
import { Pool } from "pg";
import { bancoDoSlug, validarSlug } from "./slug";

export type DadosDoGestor = { login: string; nome: string; senha: string };
export type DadosDoTenant = { slug: string; nome: string; uf: string; fuso?: string; gestor?: DadosDoGestor | null };

// T1.9: o primeiro gestor do município (escopo município). Idempotente: login existente é reaproveitado.
async function criarGestor(url: string, gestor: DadosDoGestor): Promise<string> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle(pool, { schema: schemaMunicipal }) as DbDoTenant;
    const [existe] = await db
      .select({ id: usuarioPainel.id })
      .from(usuarioPainel)
      .where(eq(usuarioPainel.username, gestor.login.toLowerCase()));
    const id = existe?.id ?? (await criarUsuarioPainel(db, gestor)).id;
    await concederPerfis(db, id, [{ perfil: "gestor", unidadeId: null }], null);
    return id;
  } finally {
    await pool.end();
  }
}

// T1.7 / PD-14: cada passo é idempotente, então rodar de novo com um slug em `criando` retoma de onde parou:
// 1. grava `municipio` em `criando`; 2. `CREATE DATABASE` se não existe; 3. migra; 4. marca `ativo`.
export async function criarTenant(
  dados: DadosDoTenant,
  deps: { central: Db; template: string },
): Promise<{ municipioId: string; gestorId?: string }> {
  const { central, template } = deps;
  if (!validarSlug(dados.slug)) {
    throw new ErroApi(400, "slug_invalido");
  }
  const banco = bancoDoSlug(dados.slug);

  // Passo 1, fora da transação para a linha ficar registrada mesmo se um passo seguinte cair.
  // O unique de `slug` decide entre chamadas simultâneas; quem perde reencontra a linha abaixo.
  await central
    .insert(municipio)
    .values({
      slug: dados.slug,
      nome: dados.nome,
      uf: dados.uf,
      ...(dados.fuso ? { fuso: dados.fuso } : {}),
      bancoRef: `template:${banco}`,
      status: "criando",
    })
    .onConflictDoNothing({ target: municipio.slug });

  return central.transaction(async (tx) => {
    // Trava a linha até o fim: uma segunda chamada com o mesmo slug espera aqui e depois a vê `ativo`.
    const [linha] = await tx.select().from(municipio).where(eq(municipio.slug, dados.slug)).for("update");
    if (!linha) {
      throw new Error(`município ${dados.slug} sumiu durante a criação`);
    }
    if (linha.status !== "criando") {
      throw new ErroApi(409, "municipio_existe");
    }

    const url = template.replace("{banco}", banco);

    // Passo 2: `CREATE DATABASE` não roda em transação; vai por um cliente próprio, fora do pool do central,
    // para não disputar conexão com a transação que segura a linha.
    await criarBancoSeNaoExiste(url, banco);

    // Passo 3: o migrador guarda o estado no próprio banco; migrar de novo não refaz nada.
    const { versao } = await migrarBanco(url, "municipal");
    const gestorId = dados.gestor ? await criarGestor(url, dados.gestor) : undefined;

    // Passo 4.
    await tx
      .update(municipio)
      .set({ status: "ativo", migracaoVersao: versao, migracaoErro: null })
      .where(eq(municipio.id, linha.id));

    return { municipioId: linha.id, ...(gestorId ? { gestorId } : {}) };
  });
}
