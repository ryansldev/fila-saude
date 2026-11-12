import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { estacao } from "./estacao";
import { servico } from "./servico";

export const visibilidadeSessao = pgEnum("visibilidade_sessao", ["publica", "privada"]);
export const estadoSessao = pgEnum("estado_sessao", ["planejada", "aberta", "cancelada", "encerrada"]);

// INV-02 / PD-37: `ocupadas` é contador gravado, com trava otimista em `versao`. AD-016: dispensa só em pública.
export const sessao = pgTable(
  "sessao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    servicoId: uuid("servico_id")
      .notNull()
      .references(() => servico.id),
    inicio: timestamp("inicio", { withTimezone: true }).notNull(),
    fim: timestamp("fim", { withTimezone: true }).notNull(),
    vagas: integer("vagas"),
    ocupadas: integer("ocupadas").notNull().default(0),
    visibilidade: visibilidadeSessao("visibilidade").notNull().default("privada"),
    dispensaPreCadastro: boolean("dispensa_pre_cadastro").notNull().default(false),
    profissional: text("profissional"),
    estado: estadoSessao("estado").notNull().default("planejada"),
    versao: integer("versao").notNull().default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("sessao_fim_depois", sql`${t.fim} > ${t.inicio}`),
    check("sessao_vagas_minimo", sql`${t.vagas} is null or ${t.vagas} >= 1`),
    check("sessao_ocupadas", sql`${t.ocupadas} >= 0 and (${t.vagas} is null or ${t.ocupadas} <= ${t.vagas})`),
    check("sessao_dispensa_publica", sql`not ${t.dispensaPreCadastro} or ${t.visibilidade} = 'publica'`),
  ],
);

export const sessaoEstacao = pgTable(
  "sessao_estacao",
  {
    sessaoId: uuid("sessao_id")
      .notNull()
      .references(() => sessao.id, { onDelete: "cascade" }),
    estacaoId: uuid("estacao_id")
      .notNull()
      .references(() => estacao.id),
  },
  (t) => [primaryKey({ columns: [t.sessaoId, t.estacaoId] })],
);
