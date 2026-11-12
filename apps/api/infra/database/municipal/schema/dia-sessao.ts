import type { DiaSessao } from "@fila-saude/domain";
import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sessao } from "./sessao";

// PD-43 / PD-44: a fila do dia é o `DiaSessao` do domínio inteiro; nasce na abertura da sessão.
export const diaSessao = pgTable("dia_sessao", {
  sessaoId: uuid("sessao_id")
    .primaryKey()
    .references(() => sessao.id),
  dia: jsonb("dia").$type<DiaSessao>().notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});
