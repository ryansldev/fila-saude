import { char, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const municipalityStatus = pgEnum("municipality_status", ["creating", "active", "suspended"]);

// PD-14: o central guarda só a referência ao banco do tenant (`template:<banco>` ou `env:<VAR>`), nunca a URL.
export const municipality = pgTable("municipality", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  uf: char("uf", { length: 2 }).notNull(),
  timeZone: text("time_zone").notNull().default("America/Sao_Paulo"),
  databaseRef: text("database_ref").notNull(),
  status: municipalityStatus("status").notNull().default("creating"),
  migrationVersion: text("migration_version"),
  migrationError: text("migration_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
