import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// PD-49 / T2.4: outbox dos avisos ao paciente. Nasce na mesma transação do evento da fila; a chave
// única garante que cada aviso sai uma vez só (T3.8). Texto sem dado clínico (RN-NOT-01).
export const aviso = pgTable(
  "aviso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chave: text("chave").notNull().unique(),
    /** Conta da central que recebe o push (`entrada.responsavel_paciente_id`). */
    pacienteId: text("paciente_id").notNull(),
    entradaId: uuid("entrada_id"),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    corpo: text("corpo").notNull(),
    /** pendente → enviado | sem_dispositivo | falhou (desistiu depois das tentativas). */
    estado: text("estado").notNull().default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    proximaTentativaEm: timestamp("proxima_tentativa_em", { withTimezone: true }).notNull().defaultNow(),
    ultimoErro: text("ultimo_erro"),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("aviso_pendente_idx").on(t.estado, t.proximaTentativaEm)],
);
