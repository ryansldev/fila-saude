import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { usuarioPainel } from "./auth";
import { unidade } from "./unidade";

export const ocupacao = pgEnum("ocupacao", [
  "medico",
  "enfermeiro",
  "tecnico_enfermagem",
  "cirurgiao_dentista",
  "auxiliar_saude_bucal",
  "acs",
  "recepcao",
  "farmaceutico",
  "psicologo",
  "fisioterapeuta",
  "nutricionista",
  "assistente_social",
]);
export const funcao = pgEnum("funcao", ["gestao_sms", "regulacao_sms", "gerente_ubs", "agendar"]);

// Ocupação da pessoa numa unidade (alinhada ao vínculo CBO no CNES).
export const vinculo = pgTable(
  "vinculo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarioPainel.id, { onDelete: "cascade" }),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => unidade.id),
    ocupacao: ocupacao("ocupacao").notNull(),
    concedidoPor: text("concedido_por"),
    concedidoEm: timestamp("concedido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("vinculo_unico").on(t.usuarioId, t.unidadeId, t.ocupacao)],
);

// Funções de gestão e a permissão "agendar". SMS e regulação são do município; gerente e agendar, de uma unidade.
export const funcaoUsuario = pgTable(
  "funcao_usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarioPainel.id, { onDelete: "cascade" }),
    funcao: funcao("funcao").notNull(),
    unidadeId: uuid("unidade_id").references(() => unidade.id),
    concedidoPor: text("concedido_por"),
    concedidoEm: timestamp("concedido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("funcao_usuario_unica").on(t.usuarioId, t.funcao, t.unidadeId).nullsNotDistinct(),
    check("funcao_usuario_escopo", sql`(${t.funcao} in ('gestao_sms', 'regulacao_sms')) = (${t.unidadeId} is null)`),
  ],
);
