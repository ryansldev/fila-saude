import { sql } from "drizzle-orm";
import { date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Pessoa atendida no município (PD-16). `paciente_id` guarda o id do paciente no central (AD-035),
// sem chave estrangeira: os bancos são separados.
export const pessoaLocal = pgTable(
  "pessoa_local",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    nascimento: date("nascimento").notNull(),
    cpf: text("cpf"),
    pacienteId: text("paciente_id"),
    documentoConferidoPor: text("documento_conferido_por"),
    documentoConferidoEm: timestamp("documento_conferido_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [uniqueIndex("pessoa_local_cpf_unico").on(tabela.cpf).where(sql`${tabela.cpf} is not null`)],
);
