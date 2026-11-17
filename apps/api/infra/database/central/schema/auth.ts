import { relations } from "drizzle-orm";
import { boolean, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// PD-23: a tabela do usuário do better-auth central é o paciente (`user.modelName = "paciente"`).
// `username` (plugin username) e `cpf` guardam o mesmo CPF só com dígitos; o UNIQUE dos dois
// fecha a corrida de dois cadastros simultâneos (RN-ID-02). INV-11: nada de sintoma, documento ou fila.
export const patient = pgTable("patient", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  cpf: text("cpf").notNull().unique(),
  birthDate: date("birth_date", { mode: "string" }).notNull(),
  phone: text("phone").notNull(),
  // RN-ID-05: nulos até a recepção conferir o documento; nunca vêm do cliente.
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationMethod: text("verification_method"),
  verifiedMunicipality: uuid("verified_municipality"),
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
      .references(() => patient.id, { onDelete: "cascade" }),
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
      .references(() => patient.id, { onDelete: "cascade" }),
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

export const patientRelations = relations(patient, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  patient: one(patient, {
    fields: [session.userId],
    references: [patient.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  patient: one(patient, {
    fields: [account.userId],
    references: [patient.id],
  }),
}));
