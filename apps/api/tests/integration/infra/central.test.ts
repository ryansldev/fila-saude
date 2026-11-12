import { sql } from "drizzle-orm";
import database from "infra/database";
import { describe, expect, it } from "vitest";

// INV-11: o central nunca guarda sintoma, documento nem dado de fila.
// Coluna nova no central exige atualizar esta lista de propósito.
const colunasPermitidas = [
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
  "municipio.banco_ref",
  "municipio.criado_em",
  "municipio.fuso",
  "municipio.id",
  "municipio.migracao_erro",
  "municipio.migracao_versao",
  "municipio.nome",
  "municipio.slug",
  "municipio.status",
  "municipio.uf",
  "paciente.cpf",
  "paciente.created_at",
  "paciente.display_username",
  "paciente.email",
  "paciente.email_verified",
  "paciente.id",
  "paciente.image",
  "paciente.name",
  "paciente.nascimento",
  "paciente.telefone",
  "paciente.updated_at",
  "paciente.username",
  "paciente.verificado_em",
  "paciente.verificado_metodo",
  "paciente.verificado_municipio",
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
  it("PD-16: banco central migrado tem municipio e as tabelas do better-auth", async () => {
    const resultado = await database.execute<{ banco: string; table_name: string }>(sql`
      select current_database() as banco, table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);

    expect(resultado.rows[0]?.banco).toBe("fila_central");
    const tabelas = resultado.rows.map((linha) => linha.table_name);
    expect(tabelas).toEqual(["account", "municipio", "paciente", "session", "verification"]);
  });

  it("INV-11: o central só tem colunas permitidas", async () => {
    const resultado = await database.execute<{ coluna: string }>(sql`
      select table_name || '.' || column_name as coluna
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, column_name
    `);

    const colunas = resultado.rows.map((linha) => linha.coluna);
    expect(colunas).toEqual(colunasPermitidas);
  });
});
