import type { PartialConfig } from "@fila-saude/domain";
import { doublePrecision, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const unitKind = pgEnum("unit_kind", ["ubs", "polyclinic", "upa"]);

export type Time = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", { opens: string; closes: string }[]>>;

// specs/modelo · PD-35: a configuração própria da unidade é o mesmo `PartialConfig` do domínio.
export const unit = pgTable("unit", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: unitKind("kind").notNull().default("ubs"),
  cnes: text("cnes"),
  postalCode: text("postal_code").notNull().default(""),
  street: text("street").notNull().default(""),
  number: text("number").notNull().default(""),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  timeZone: text("time_zone").notNull(),
  time: jsonb("time").$type<Time>().notNull().default({}),
  config: jsonb("config").$type<PartialConfig>().notNull().default({}),
  // Unidade removida pela SMS: fica no banco pelo histórico e some das listas.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
