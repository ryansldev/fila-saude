import type { ConfigParcial } from "@fila-saude/domain";
import { doublePrecision, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tipoUnidade = pgEnum("tipo_unidade", ["ubs", "policlinica", "upa"]);

export type Horario = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", { abre: string; fecha: string }[]>>;

// specs/modelo · PD-35: a configuração própria da unidade é o mesmo `ConfigParcial` do domínio.
export const unidade = pgTable("unidade", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  tipo: tipoUnidade("tipo").notNull().default("ubs"),
  cnes: text("cnes"),
  cep: text("cep").notNull().default(""),
  logradouro: text("logradouro").notNull().default(""),
  numero: text("numero").notNull().default(""),
  complemento: text("complemento"),
  bairro: text("bairro").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  fuso: text("fuso").notNull(),
  horario: jsonb("horario").$type<Horario>().notNull().default({}),
  config: jsonb("config").$type<ConfigParcial>().notNull().default({}),
  // Unidade removida pela SMS: fica no banco pelo histórico e some das listas.
  arquivadaEm: timestamp("arquivada_em", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});
