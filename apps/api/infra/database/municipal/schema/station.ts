import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { service } from "./service";
import { unit } from "./unit";

export const stage = pgEnum("stage", ["triage", "care"]);

// RN-EST-01 / RN-TRI-02: estação ligada a uma etapa e aos serviços que atende.
export const station = pgTable("station", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => unit.id),
  name: text("name").notNull(),
  stage: stage("stage").notNull(),
  open: boolean("open").notNull().default(false),
  lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stationService = pgTable(
  "station_service",
  {
    stationId: uuid("station_id")
      .notNull()
      .references(() => station.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id),
  },
  (t) => [primaryKey({ columns: [t.stationId, t.serviceId] })],
);
