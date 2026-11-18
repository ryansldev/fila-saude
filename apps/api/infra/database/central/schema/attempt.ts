import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// NC5 / RN-ID-04 / RN-ID-07: contagem de tentativas (login e CPFs informados), comum a todas as instâncias
// da API. A chave é o HMAC de CPF, login ou IP, nunca o valor. A migração cria a tabela como UNLOGGED:
// fora do WAL, do backup e das réplicas (contagens de minutos não devem sobreviver em backup).
export const attempt = pgTable(
  "attempt",
  {
    key: text("key").primaryKey(),
    state: jsonb("state").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("attempt_expires_at_idx").on(t.expiresAt)],
);
