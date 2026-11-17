import { sql } from "drizzle-orm";
import { date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Pessoa atendida no município (PD-16). `patient_id` guarda o id do paciente no central (AD-035),
// sem chave estrangeira: os bancos são separados.
export const localPerson = pgTable(
  "local_person",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    birthDate: date("birth_date").notNull(),
    cpf: text("cpf"),
    patientId: text("patient_id"),
    documentVerifiedBy: text("document_verified_by"),
    documentVerifiedAt: timestamp("document_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("unique_cpf_local_person").on(table.cpf).where(sql`${table.cpf} is not null`)],
);
