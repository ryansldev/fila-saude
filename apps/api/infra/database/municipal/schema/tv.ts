import { char, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { unit } from "./unit";

// PD-47 / RN-TV-01: a TV é um dispositivo; o token do navegador é a credencial (só o hash fica aqui).
export const tv = pgTable(
  "tv",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: char("code", { length: 6 }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    unitId: uuid("unit_id").references(() => unit.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    pairedAt: timestamp("paired_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),
  },
  (t) => [index("code_tv_idx").on(t.code)],
);
