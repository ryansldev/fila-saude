import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// PD-49 / T2.4: outbox dos avisos ao paciente. Nasce na mesma transação do evento da fila; a chave
// única garante que cada aviso sai uma vez só (T3.8). Texto sem dado clínico (RN-NOT-01).
export const notice = pgTable(
  "notice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    /** Conta da central que recebe o push (`entry.guardian_patient_id`). */
    patientId: text("patient_id").notNull(),
    entryId: uuid("entry_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** pending → sent | no_device | failed (desistiu depois das tentativas). */
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pending_notice_idx").on(t.state, t.nextAttemptAt)],
);
