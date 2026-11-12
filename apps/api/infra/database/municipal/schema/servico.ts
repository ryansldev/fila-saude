import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { unidade } from "./unidade";

export const modoServico = pgEnum("modo_servico", ["livre", "requisicao", "regulado"]);

// specs/modelo · T2.3: prefixo único na unidade; tempos médios por etapa.
export const servico = pgTable(
  "servico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => unidade.id),
    nome: text("nome").notNull(),
    prefixo: text("prefixo").notNull(),
    exigeTriagem: boolean("exige_triagem").notNull().default(false),
    modo: modoServico("modo").notNull().default("livre"),
    tempoMedioTriagemMin: integer("tempo_medio_triagem_min"),
    tempoMedioAtendimentoMin: integer("tempo_medio_atendimento_min").notNull().default(15),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("servico_prefixo_unico").on(t.unidadeId, t.prefixo),
    check("servico_prefixo_formato", sql`${t.prefixo} ~ '^[A-Z]{1,3}$'`),
  ],
);
