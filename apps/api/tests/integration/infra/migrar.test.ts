import { sql } from "drizzle-orm";
import database from "infra/database";
import { migrarBanco } from "infra/database/migrar";
import env from "infra/env";
import { Client, escapeIdentifier } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// PD-19: cada arquivo cria os próprios bancos com nome único e derruba no afterAll.
const banco = `fila_t_${Date.now().toString(36)}migrar`;
const urlDoTenant = env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", banco);

function urlDoServidor() {
  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}

async function conectado<T>(url: string, fn: (cliente: Client) => Promise<T>) {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    return await fn(cliente);
  } finally {
    await cliente.end();
  }
}

async function tabelasDoCentral() {
  const resultado = await database.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables where table_schema = 'public'
  `);
  // Ordena no JS para não depender da collation do banco.
  return resultado.rows.map((linha) => linha.table_name).sort();
}

describe("migrarBanco", () => {
  let tabelasDoCentralAntes: string[] = [];
  let versaoDaPrimeira = "";

  beforeAll(async () => {
    tabelasDoCentralAntes = await tabelasDoCentral();
    await conectado(urlDoServidor(), (cliente) => cliente.query(`create database ${escapeIdentifier(banco)}`));
  });

  afterAll(async () => {
    await conectado(urlDoServidor(), (cliente) =>
      cliente.query(`drop database if exists ${escapeIdentifier(banco)} with (force)`),
    );
  });

  it("PD-16: migrarBanco cria as tabelas municipais num banco vazio", async () => {
    const { versao } = await migrarBanco(urlDoTenant, "municipal");
    versaoDaPrimeira = versao;
    expect(versao).toMatch(/^0000_/);

    await conectado(urlDoTenant, async (tenant) => {
      const colunas = await tenant.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `select column_name, data_type, is_nullable
         from information_schema.columns
         where table_schema = 'public' and table_name = 'pessoa_local'`,
      );
      const porNome = Object.fromEntries(
        colunas.rows.map((c) => [c.column_name, { tipo: c.data_type, nulo: c.is_nullable === "YES" }]),
      );
      expect(porNome).toEqual({
        id: { tipo: "uuid", nulo: false },
        nome: { tipo: "text", nulo: false },
        nascimento: { tipo: "date", nulo: false },
        cpf: { tipo: "text", nulo: true },
        paciente_id: { tipo: "text", nulo: true },
        documento_conferido_por: { tipo: "text", nulo: true },
        documento_conferido_em: { tipo: "timestamp with time zone", nulo: true },
        criado_em: { tipo: "timestamp with time zone", nulo: false },
      });

      // Índice único parcial: várias pessoas sem CPF convivem, o mesmo CPF duas vezes não.
      await tenant.query(
        "insert into pessoa_local (nome, nascimento) values ('Ana', '1990-01-01'), ('Bia', '1991-02-02')",
      );
      await tenant.query(
        "insert into pessoa_local (nome, nascimento, cpf) values ('Caio', '1980-03-03', '12345678909')",
      );
      await expect(
        tenant.query("insert into pessoa_local (nome, nascimento, cpf) values ('Davi', '1981-04-04', '12345678909')"),
      ).rejects.toThrow(/duplicate key/);
    });
  });

  it("PD-16: migrar de novo não muda nada", async () => {
    const { versao } = await migrarBanco(urlDoTenant, "municipal");
    expect(versao).toBe(versaoDaPrimeira);

    await conectado(urlDoTenant, async (tenant) => {
      const aplicadas = await tenant.query("select 1 from drizzle.__drizzle_migrations");
      expect(aplicadas.rowCount).toBe(1);
      const pessoas = await tenant.query("select 1 from pessoa_local");
      expect(pessoas.rowCount).toBe(3);
    });
  });

  it("INV-11: schema municipal não cria tabela no central", async () => {
    const tabelasDepois = await tabelasDoCentral();
    expect(tabelasDepois).toEqual(tabelasDoCentralAntes);
    expect(tabelasDepois).not.toContain("pessoa_local");
  });
});
