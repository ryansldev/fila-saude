import { relations } from "drizzle-orm";
import { boolean, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// PD-23: a tabela do usuário do better-auth central é o paciente (`user.modelName = "paciente"`).
// `username` (plugin username) e `cpf` guardam o mesmo CPF só com dígitos; o UNIQUE dos dois
// fecha a corrida de dois cadastros simultâneos (RN-ID-02). INV-11: nada de sintoma, documento ou fila.
export const paciente = pgTable("paciente", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  cpf: text("cpf").notNull().unique(),
  nascimento: date("nascimento", { mode: "string" }).notNull(),
  telefone: text("telefone").notNull(),
  // RN-ID-05: nulos até a recepção conferir o documento; nunca vêm do cliente.
  verificadoEm: timestamp("verificado_em", { withTimezone: true }),
  verificadoMetodo: text("verificado_metodo"),
  verificadoMunicipio: uuid("verificado_municipio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => paciente.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => paciente.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const pacienteRelations = relations(paciente, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  paciente: one(paciente, {
    fields: [session.userId],
    references: [paciente.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  paciente: one(paciente, {
    fields: [account.userId],
    references: [paciente.id],
  }),
}));
