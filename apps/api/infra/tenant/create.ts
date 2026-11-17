import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createStaffUser } from "infra/auth/panel";
import type { Db } from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { createDatabaseIfMissing } from "infra/database/create-database";
import { migrateDatabase } from "infra/database/migrate";
import { staffUser } from "infra/database/municipal/schema/auth";
import { schemaMunicipal, type TenantDb } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { grantAssignments } from "infra/panel/profiles";
import { Pool } from "pg";
import { databaseForSlug, validateSlug } from "./slug";

export type ManagerData = { login: string; name: string; password: string };
export type TenantData = { slug: string; name: string; uf: string; timeZone?: string; manager?: ManagerData | null };

// T1.9: o primeiro usuário do município, com a função Gestão SMS. Idempotente: login existente é reaproveitado.
async function createManager(url: string, manager: ManagerData): Promise<string> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle(pool, { schema: schemaMunicipal }) as TenantDb;
    const [exists] = await db
      .select({ id: staffUser.id })
      .from(staffUser)
      .where(eq(staffUser.username, manager.login.toLowerCase()));
    const id = exists?.id ?? (await createStaffUser(db, manager)).id;
    await grantAssignments(db, id, { unitLinks: [], roles: [{ role: "sms_management", unitId: null }] }, null);
    return id;
  } finally {
    await pool.end();
  }
}

// T1.7 / PD-14: cada passo é idempotente, então rodar de novo com um slug em `criando` retoma de onde parou:
// 1. grava `municipio` em `criando`; 2. `CREATE DATABASE` se não existe; 3. migra; 4. marca `ativo`.
export async function createTenant(
  data: TenantData,
  deps: { central: Db; template: string },
): Promise<{ municipalityId: string; managerId?: string }> {
  const { central, template } = deps;
  if (!validateSlug(data.slug)) {
    throw new ApiError(400, "invalid_slug");
  }
  const database = databaseForSlug(data.slug);

  // Passo 1, fora da transação para a linha ficar registrada mesmo se um passo seguinte cair.
  // O unique de `slug` decide entre chamadas simultâneas; quem perde reencontra a linha abaixo.
  await central
    .insert(municipality)
    .values({
      slug: data.slug,
      name: data.name,
      uf: data.uf,
      ...(data.timeZone ? { timeZone: data.timeZone } : {}),
      databaseRef: `template:${database}`,
      status: "creating",
    })
    .onConflictDoNothing({ target: municipality.slug });

  return central.transaction(async (tx) => {
    // Trava a linha até o fim: uma segunda chamada com o mesmo slug espera aqui e depois a vê `ativo`.
    const [row] = await tx.select().from(municipality).where(eq(municipality.slug, data.slug)).for("update");
    if (!row) {
      throw new Error(`município ${data.slug} sumiu durante a criação`);
    }
    if (row.status !== "creating") {
      throw new ApiError(409, "municipality_exists");
    }

    const url = template.replace("{database}", database);

    // Passo 2: `CREATE DATABASE` não roda em transação; vai por um cliente próprio, fora do pool do central,
    // para não disputar conexão com a transação que segura a linha.
    await createDatabaseIfMissing(url, database);

    // Passo 3: o migrador guarda o estado no próprio banco; migrar de novo não refaz nada.
    const { version } = await migrateDatabase(url, "municipal");
    const managerId = data.manager ? await createManager(url, data.manager) : undefined;

    // Passo 4.
    await tx
      .update(municipality)
      .set({ status: "active", migrationVersion: version, migrationError: null })
      .where(eq(municipality.id, row.id));

    return { municipalityId: row.id, ...(managerId ? { managerId } : {}) };
  });
}
