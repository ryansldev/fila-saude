import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { service } from "./service";
import { station } from "./station";

export const sessionVisibility = pgEnum("session_visibility", ["public", "private"]);
export const sessionState = pgEnum("session_state", ["planned", "open", "cancelled", "closed"]);

// INV-02 / PD-37: `ocupadas` é contador gravado, com trava otimista em `versao`. AD-016: dispensa só em pública.
export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id),
    start: timestamp("start", { withTimezone: true }).notNull(),
    end: timestamp("end", { withTimezone: true }).notNull(),
    slots: integer("slots"),
    taken: integer("taken").notNull().default(0),
    visibility: sessionVisibility("visibility").notNull().default("private"),
    waivesPreRegistration: boolean("waives_pre_registration").notNull().default(false),
    professional: text("professional"),
    state: sessionState("state").notNull().default("planned"),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("session_end_after_start", sql`${t.end} > ${t.start}`),
    check("session_min_slots", sql`${t.slots} is null or ${t.slots} >= 1`),
    check("session_taken_within_slots", sql`${t.taken} >= 0 and (${t.slots} is null or ${t.taken} <= ${t.slots})`),
    check("session_waiver_only_public", sql`not ${t.waivesPreRegistration} or ${t.visibility} = 'public'`),
  ],
);

export const sessionStation = pgTable(
  "session_station",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    stationId: uuid("station_id")
      .notNull()
      .references(() => station.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.stationId] })],
);
