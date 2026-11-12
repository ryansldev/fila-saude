import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { usuarioPainel } from "./auth";
import { unidade } from "./unidade";

export const perfilPainel = pgEnum("perfil_painel", [
  "gestor",
  "admin",
  "agendador",
  "recepcao",
  "triagem",
  "profissional",
]);

// RN-PERF-01: perfis acumuláveis; gestor tem escopo município (sem unidade), os outros, uma unidade.
export const perfilUsuario = pgTable(
  "perfil_usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarioPainel.id, { onDelete: "cascade" }),
    perfil: perfilPainel("perfil").notNull(),
    unidadeId: uuid("unidade_id").references(() => unidade.id),
    concedidoPor: text("concedido_por"),
    concedidoEm: timestamp("concedido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("perfil_usuario_unico").on(t.usuarioId, t.perfil, t.unidadeId).nullsNotDistinct(),
    check("perfil_usuario_escopo", sql`(${t.perfil} = 'gestor') = (${t.unidadeId} is null)`),
  ],
);
