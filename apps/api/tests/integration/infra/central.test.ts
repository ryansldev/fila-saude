import { sql } from "drizzle-orm";
import database from "infra/database";
import { describe, expect, it } from "vitest";

// INV-11: o central nunca guarda sintoma, documento nem dado de fila.
// Coluna nova no central exige atualizar esta lista de propósito.
const allowedColumns = [
  "account.access_token",
  "account.access_token_expires_at",
  "account.account_id",
  "account.created_at",
  "account.id",
  "account.id_token",
  "account.password",
  "account.provider_id",
  "account.refresh_token",
  "account.refresh_token_expires_at",
  "account.scope",
  "account.updated_at",
  "account.user_id",
  // AD-063: só o HMAC da chave e a contagem (nada de sintoma, documento ou fila).
  "attempt.expires_at",
  "attempt.key",
  "attempt.state",
  "municipality.created_at",
  "municipality.database_ref",
  "municipality.id",
  "municipality.migration_error",
  "municipality.migration_version",
  "municipality.name",
  "municipality.slug",
  "municipality.status",
  "municipality.time_zone",
  "municipality.uf",
  "patient.birth_date",
  "patient.cpf",
  "patient.created_at",
  "patient.display_username",
  "patient.email",
  "patient.email_verified",
  "patient.id",
  "patient.image",
  "patient.name",
  "patient.phone",
  "patient.updated_at",
  "patient.username",
  "patient.verification_method",
  "patient.verified_at",
  "patient.verified_municipality",
  // T3.8: token de push do aparelho; não é dado clínico nem da fila.
  "push_device.id",
  "push_device.patient_id",
  "push_device.token",
  "push_device.updated_at",
  "session.created_at",
  "session.expires_at",
  "session.id",
  "session.ip_address",
  "session.token",
  "session.updated_at",
  "session.user_agent",
  "session.user_id",
  "verification.created_at",
  "verification.expires_at",
  "verification.id",
  "verification.identifier",
  "verification.updated_at",
  "verification.value",
];

describe("banco central", () => {
  it("PD-16: banco central migrado tem municipality e as tabelas do better-auth", async () => {
    const result = await database.execute<{ database: string; table_name: string }>(sql`
      select current_database() as database, table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);

    expect(result.rows[0]?.database).toBe("fila_central");
    const tables = result.rows.map((row) => row.table_name);
    expect(tables).toEqual(["account", "attempt", "municipality", "patient", "push_device", "session", "verification"]);
  });

  it("INV-11: o central só tem colunas permitidas", async () => {
    const result = await database.execute<{ column: string }>(sql`
      select table_name || '.' || column_name as column
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, column_name
    `);

    const columns = result.rows.map((row) => row.column);
    expect(columns).toEqual(allowedColumns);
  });
});
