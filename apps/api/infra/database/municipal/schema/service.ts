import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { unit } from "./unit";

export const serviceMode = pgEnum("service_mode", ["direct", "referral", "regulated"]);

// specs/modelo · T2.3: prefixo único na unidade; tempos médios por etapa.
export const service = pgTable(
  "service",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    requiresTriage: boolean("requires_triage").notNull().default(false),
    mode: serviceMode("mode").notNull().default("direct"),
    averageTriageTimeMin: integer("average_triage_time_min"),
    averageCareTimeMin: integer("average_care_time_min").notNull().default(15),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("unique_prefix_service").on(t.unitId, t.prefix),
    check("service_prefix_format", sql`${t.prefix} ~ '^[A-Z]{1,3}$'`),
  ],
);
