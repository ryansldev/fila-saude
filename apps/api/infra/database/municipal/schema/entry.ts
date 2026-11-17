import type { Classification, LegalPriority } from "@fila-saude/domain";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { localPerson } from "./local-person";
import { service } from "./service";
import { session } from "./session";

export const entryState = pgEnum("entry_state", [
  "awaiting_referral",
  "waiting",
  "allocated",
  "confirmed",
  "in_reserve",
  "in_queue",
  "reassigned",
  "archived",
  "completed",
  "cancelled",
  "closed_without_care",
]);
export const riskLevel = pgEnum("risk_level", ["emergency", "very_urgent", "urgent", "attention", "routine"]);
export const reassignedOrigin = pgEnum("reassigned_origin", ["private", "public", "regulated"]);
export const guardianRelationship = pgEnum("guardian_relationship", [
  "legal_guardian",
  "caregiver",
  "family_or_friend",
]);

// PD-36: toda entrada aponta para uma `local_person`; INV-01 pelo índice único parcial.
export const entry = pgTable(
  "entry",
  {
    id: uuid("id").primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id),
    localPersonId: uuid("local_person_id")
      .notNull()
      .references(() => localPerson.id),
    guardianPatientId: text("guardian_patient_id"),
    /** Outra pessoa (2026-11-16): o que o responsável é dela (`legal_guardian`, `caregiver`, `family_or_friend`). */
    guardianRelationship: guardianRelationship("guardian_relationship"),
    state: entryState("state").notNull(),
    originalEntryDate: timestamp("original_entry_date", { withTimezone: true }).notNull(),
    classification: jsonb("classification").$type<Classification>().notNull(),
    confirmedRisk: riskLevel("confirmed_risk"),
    priority: jsonb("priority").$type<LegalPriority>().notNull(),
    reassigned: reassignedOrigin("reassigned"),
    refusals: integer("refusals").notNull().default(0),
    sessionId: uuid("session_id").references(() => session.id),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }),
    askedAt: timestamp("asked_at", { withTimezone: true }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    refusedSessions: uuid("refused_sessions").array().notNull().default(sql`'{}'::uuid[]`),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("single_active_entry")
      .on(t.serviceId, t.localPersonId)
      .where(sql`${t.state} not in ('cancelled','completed','closed_without_care','archived')`),
  ],
);
