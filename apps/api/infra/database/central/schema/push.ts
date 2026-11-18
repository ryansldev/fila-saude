import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { patient } from "./auth";

// T3.8: token de push (Expo) de cada aparelho da conta; um aparelho pertence a uma conta por vez.
export const pushDevice = pgTable("push_device", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patient.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
