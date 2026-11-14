import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { paciente } from "./auth";

// T3.8: token de push (Expo) de cada aparelho da conta; um aparelho pertence a uma conta por vez.
export const dispositivoPush = pgTable("dispositivo_push", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: text("paciente_id")
    .notNull()
    .references(() => paciente.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});
