import type { Classificacao, PrioridadeLegal } from "@fila-saude/domain";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pessoaLocal } from "./pessoa-local";
import { servico } from "./servico";
import { sessao } from "./sessao";

export const estadoEntrada = pgEnum("estado_entrada", [
  "aguardando_encaminhamento",
  "aguardando",
  "alocada",
  "confirmada",
  "na_reserva",
  "na_fila",
  "remanejada",
  "arquivada",
  "concluida",
  "cancelada",
  "encerrada_sem_atendimento",
]);
export const nivelRisco = pgEnum("nivel_risco", ["emergencia", "urgente", "atencao", "rotina"]);
export const origemRemanejada = pgEnum("origem_remanejada", ["privada", "publica", "regulada"]);

// PD-36: toda entrada aponta para uma `pessoa_local`; INV-01 pelo índice único parcial.
export const entrada = pgTable(
  "entrada",
  {
    id: uuid("id").primaryKey(),
    servicoId: uuid("servico_id")
      .notNull()
      .references(() => servico.id),
    pessoaLocalId: uuid("pessoa_local_id")
      .notNull()
      .references(() => pessoaLocal.id),
    responsavelPacienteId: text("responsavel_paciente_id"),
    estado: estadoEntrada("estado").notNull(),
    dataEntradaOriginal: timestamp("data_entrada_original", { withTimezone: true }).notNull(),
    classificacao: jsonb("classificacao").$type<Classificacao>().notNull(),
    riscoConfirmado: nivelRisco("risco_confirmado"),
    prioridade: jsonb("prioridade").$type<PrioridadeLegal>().notNull(),
    remanejada: origemRemanejada("remanejada"),
    recusas: integer("recusas").notNull().default(0),
    sessaoId: uuid("sessao_id").references(() => sessao.id),
    alocadaEm: timestamp("alocada_em", { withTimezone: true }),
    perguntadoEm: timestamp("perguntado_em", { withTimezone: true }),
    respondidoEm: timestamp("respondido_em", { withTimezone: true }),
    arquivadaEm: timestamp("arquivada_em", { withTimezone: true }),
    sessoesRecusadas: uuid("sessoes_recusadas").array().notNull().default(sql`'{}'::uuid[]`),
    versao: integer("versao").notNull().default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("entrada_ativa_unica")
      .on(t.servicoId, t.pessoaLocalId)
      .where(sql`${t.estado} not in ('cancelada','concluida','encerrada_sem_atendimento','arquivada')`),
  ],
);
