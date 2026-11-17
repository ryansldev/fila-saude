import type { SessionDay } from "@fila-saude/domain";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { session } from "./session";

// PD-43 / PD-44: a fila do dia é o `SessionDay` do domínio inteiro; nasce na abertura da sessão.
export const sessionDay = pgTable("session_day", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => session.id),
  day: jsonb("day").$type<SessionDay>().notNull(),
  // RN-PRES-01: segredo do HMAC do QR de entrada, criado na abertura; nunca sai da API.
  qrSecret: text("qr_secret"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
