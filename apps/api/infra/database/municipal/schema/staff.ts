import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { staffUser } from "./auth";
import { unit } from "./unit";

export const occupation = pgEnum("occupation", [
  "physician",
  "nurse",
  "nursing_technician",
  "dentist",
  "oral_health_assistant",
  "community_health_agent",
  "reception",
  "pharmacist",
  "psychologist",
  "physiotherapist",
  "nutritionist",
  "social_worker",
]);
export const role = pgEnum("role", ["sms_management", "sms_regulation", "unit_manager", "scheduler"]);

// Ocupação da pessoa numa unidade (alinhada ao vínculo CBO no CNES).
export const unitLink = pgTable(
  "unit_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => staffUser.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id),
    occupation: occupation("occupation").notNull(),
    grantedBy: text("granted_by"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("unique_unit_link").on(t.userId, t.unitId, t.occupation)],
);

// Funções de gestão e a permissão "agendar". SMS e regulação são do município; gerente e agendar, de uma unidade.
export const userRole = pgTable(
  "user_role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => staffUser.id, { onDelete: "cascade" }),
    role: role("role").notNull(),
    unitId: uuid("unit_id").references(() => unit.id),
    grantedBy: text("granted_by"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("single_user_role").on(t.userId, t.role, t.unitId).nullsNotDistinct(),
    check("user_role_scope", sql`(${t.role} in ('sms_management', 'sms_regulation')) = (${t.unitId} is null)`),
  ],
);
