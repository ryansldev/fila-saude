import type { SessionDay } from "@fila-saude/domain";
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { session } from "./session";

// PD-43 / PD-44: a fila do dia é o `SessionDay` do domínio inteiro; nasce na abertura da sessão.
export const sessionDay = pgTable(
  "session_day",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => session.id),
    day: jsonb("day").$type<SessionDay>().notNull(),
    // RN-PRES-01: segredo do HMAC do QR de entrada, criado na abertura; nunca sai da API.
    qrSecret: text("qr_secret"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // RN-FALTA-03: as faltas são lidas pela data do encerramento (janela do alerta), a cada leitura da alocação.
  (t) => [index("session_day_closing_at_idx").on(sql`((${t.day}->'closing'->>'at')::bigint)`)],
);
