import { char, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { unidade } from "./unidade";

// PD-47 / RN-TV-01: a TV é um dispositivo; o token do navegador é a credencial (só o hash fica aqui).
export const tv = pgTable(
  "tv",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codigo: char("codigo", { length: 6 }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    unidadeId: uuid("unidade_id").references(() => unidade.id),
    criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
    pareadaEm: timestamp("pareada_em", { withTimezone: true }),
    revogadaEm: timestamp("revogada_em", { withTimezone: true }),
    ultimoSinalEm: timestamp("ultimo_sinal_em", { withTimezone: true }),
  },
  (t) => [index("tv_codigo_idx").on(t.codigo)],
);
