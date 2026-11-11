import { char, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const municipioStatus = pgEnum("municipio_status", ["criando", "ativo", "suspenso"]);

// PD-14: o central guarda só a referência ao banco do tenant (`template:<banco>` ou `env:<VAR>`), nunca a URL.
export const municipio = pgTable("municipio", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  uf: char("uf", { length: 2 }).notNull(),
  fuso: text("fuso").notNull().default("America/Sao_Paulo"),
  bancoRef: text("banco_ref").notNull(),
  status: municipioStatus("status").notNull().default("criando"),
  migracaoVersao: text("migracao_versao"),
  migracaoErro: text("migracao_erro"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});
