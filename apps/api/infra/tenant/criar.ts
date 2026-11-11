import { eq, sql } from "drizzle-orm";
import type { Db } from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import { migrarBanco } from "infra/database/migrar";
import { ErroApi } from "infra/erros";
import { escapeIdentifier } from "pg";
import { bancoDoSlug, validarSlug } from "./slug";

export type DadosDoTenant = { slug: string; nome: string; uf: string; fuso?: string };

// T1.7 / PD-14: cada passo é idempotente, então rodar de novo com um slug em `criando` retoma de onde parou:
// 1. grava `municipio` em `criando`; 2. `CREATE DATABASE` se não existe; 3. migra; 4. marca `ativo`.
export async function criarTenant(
  dados: DadosDoTenant,
  deps: { central: Db; template: string },
): Promise<{ municipioId: string }> {
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

    // Passo 2: `CREATE DATABASE` não roda em transação, então vai por outra conexão do pool.
    await criarBancoSeNaoExiste(central, banco);

    // Passo 3: o migrador guarda o estado no próprio banco; migrar de novo não refaz nada.
    const { versao } = await migrarBanco(template.replace("{banco}", banco), "municipal");

    // Passo 4.
    await tx
      .update(municipio)
      .set({ status: "ativo", migracaoVersao: versao, migracaoErro: null })
      .where(eq(municipio.id, linha.id));

    return { municipioId: linha.id };
  });
}

async function criarBancoSeNaoExiste(central: Db, banco: string) {
  const existe = await central.execute(sql`select 1 from pg_database where datname = ${banco}`);
  if (existe.rows.length > 0) return;

  try {
    await central.execute(sql.raw(`create database ${escapeIdentifier(banco)}`));
  } catch (erro) {
    // 42P04 (duplicate_database): alguém criou entre a consulta e o CREATE; o resultado é o mesmo.
    if (codigoPostgres(erro) !== "42P04") throw erro;
  }
}

function codigoPostgres(erro: unknown): string | undefined {
  // O drizzle embrulha o erro do pg em `cause`.
  for (let atual: unknown = erro; atual instanceof Error; atual = atual.cause) {
    const codigo = (atual as { code?: unknown }).code;
    if (typeof codigo === "string") return codigo;
  }
  return undefined;
}
