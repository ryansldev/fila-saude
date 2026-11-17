import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// INV-12 / RNF-SEG-04: quem, o quê, quando e em quê; sem dado clínico.
export const audit = pgTable("audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  targetKind: text("target_kind").notNull(),
  targetId: text("target_id").notNull(),
  unitId: uuid("unit_id"),
  reason: text("reason"),
  data: jsonb("data").$type<Record<string, unknown>>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
