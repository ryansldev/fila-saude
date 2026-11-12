import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { servico } from "./servico";
import { unidade } from "./unidade";

export const etapa = pgEnum("etapa", ["triagem", "atendimento"]);

// RN-EST-01 / RN-TRI-02: estação ligada a uma etapa e aos serviços que atende.
export const estacao = pgTable("estacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  unidadeId: uuid("unidade_id")
    .notNull()
    .references(() => unidade.id),
  nome: text("nome").notNull(),
  etapa: etapa("etapa").notNull(),
  aberta: boolean("aberta").notNull().default(false),
  ultimoSinalEm: timestamp("ultimo_sinal_em", { withTimezone: true }),
  arquivadaEm: timestamp("arquivada_em", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const estacaoServico = pgTable(
  "estacao_servico",
  {
    estacaoId: uuid("estacao_id")
      .notNull()
      .references(() => estacao.id),
    servicoId: uuid("servico_id")
      .notNull()
      .references(() => servico.id),
  },
  (t) => [primaryKey({ columns: [t.estacaoId, t.servicoId] })],
);
