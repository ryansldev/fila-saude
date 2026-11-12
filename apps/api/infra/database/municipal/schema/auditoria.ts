import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// INV-12 / RNF-SEG-04: quem, o quê, quando e em quê; sem dado clínico.
export const auditoria = pgTable("auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: text("usuario_id").notNull(),
  acao: text("acao").notNull(),
  alvoTipo: text("alvo_tipo").notNull(),
  alvoId: text("alvo_id").notNull(),
  unidadeId: uuid("unidade_id"),
  motivo: text("motivo"),
  dados: jsonb("dados").$type<Record<string, unknown>>(),
  em: timestamp("em", { withTimezone: true }).notNull().defaultNow(),
});
