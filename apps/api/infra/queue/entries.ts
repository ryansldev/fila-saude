import { randomUUID } from "node:crypto";
import {
  type Answers,
  createEntry,
  type Entry,
  effectiveConfig,
  INACTIVE_ENTRY_STATES,
  properName,
  type Result,
} from "@fila-saude/domain";
import type { Relationship } from "@fila-saude/schemas/queue";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { entry } from "infra/database/municipal/schema/entry";
import { localPerson } from "infra/database/municipal/schema/local-person";
import { service } from "infra/database/municipal/schema/service";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase, TenantDb, TenantTx } from "infra/database/tenants";
import { ApiError } from "infra/errors";

export type InformedPerson = {
  name: string;
  birthDate: string;
  cpf: string | null;
  patientId: string | null;
  /** Outra pessoa: a relação declarada por quem inscreve. */
  relationship?: Relationship | null;
};

const FINAL_STATES = INACTIVE_ENTRY_STATES;

const ms = (d: Date | null) => (d ? d.getTime() : null);
const data = (n: number | null) => (n === null ? null : new Date(n));

/** Primeiro nome sem acento e em minúsculas, só para comparar (não é o `firstName` de exibição). */
const comparableFirstName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)[0] ?? "";

/**
 * Quem informa um CPF já cadastrado precisa conhecer a pessoa: mesma data de nascimento e, para
 * "outra pessoa", mesmo primeiro nome. Senão, um CPF bastaria para ver o nome de alguém, ocupar a vaga
 * dele ou herdar a conferência de documentos (revisão 2026-11-13). A resposta não diz qual dado diverge.
 * Roda antes de qualquer outra checagem (inclusive "duplicada"), para não confirmar que o CPF está na fila.
 */
export async function personByCpf(db: TenantDatabase, p: InformedPerson) {
  if (!p.cpf) return null;
  const [existing] = await db.select().from(localPerson).where(eq(localPerson.cpf, p.cpf));
  if (!existing) return null;
  // O dono do CPF criando a conta assume o cadastro feito por terceiros ("outra pessoa"), com os dados
  // da conta: dados errados digitados por outra pessoa não o trancam fora.
  if (p.patientId && !existing.patientId) return existing;
  const otherAccount = p.patientId && existing.patientId && existing.patientId !== p.patientId;
  const nameDiverges = !p.patientId && comparableFirstName(existing.name) !== comparableFirstName(p.name);
  if (otherAccount || existing.birthDate !== p.birthDate || nameDiverges) {
    throw new ApiError(
      409,
      "person_mismatch",
      undefined,
      "Esse CPF já está cadastrado com outros dados. Confira o CPF, o nome e a data de nascimento, ou procure a recepção.",
    );
  }
  return existing;
}

// RN-LE-02 / AD-035: com CPF, a mesma pessoa local; o dono da conta fica ligado pelo `patient_id`.
// O nome é gravado com maiúscula (regra dos nomes), então a fila, a estação e a TV já o recebem certo.
export async function attendedPerson(db: TenantDatabase, p: InformedPerson): Promise<{ id: string }> {
  const existing = await personByCpf(db, p);
  if (existing) {
    if (p.patientId && !existing.patientId) {
      await db
        .update(localPerson)
        .set({ patientId: p.patientId, name: properName(p.name), birthDate: p.birthDate })
        .where(eq(localPerson.id, existing.id));
    }
    return { id: existing.id };
  }
  const [fresh] = await db
    .insert(localPerson)
    .values({ name: properName(p.name), birthDate: p.birthDate, cpf: p.cpf, patientId: p.patientId })
    .returning({ id: localPerson.id });
  if (!fresh) throw new Error("pessoa_local não criada");
  return fresh;
}

export async function insertEntry(
  db: TenantDatabase,
  e: Entry,
  localPersonId: string,
  relationship: Relationship | null = null,
): Promise<void> {
  await db.insert(entry).values({
    id: e.id,
    serviceId: e.serviceId,
    localPersonId,
    guardianPatientId: e.guardianId,
    guardianRelationship: relationship,
    state: e.state,
    originalEntryDate: new Date(e.originalEntryDate),
    classification: e.classification,
    confirmedRisk: e.confirmedRisk,
    priority: e.priority,
    reassigned: e.reassigned,
    refusals: e.refusals,
    sessionId: e.sessionId,
    allocatedAt: data(e.allocatedAt),
    askedAt: data(e.askedAt),
    answeredAt: data(e.answeredAt),
    archivedAt: data(e.archivedAt),
    refusedSessions: e.refusedSessions,
  });
}

type Row = { e: typeof entry.$inferSelect; p: typeof localPerson.$inferSelect };

function forEntry({ e, p }: Row): Entry {
  return {
    id: e.id,
    serviceId: e.serviceId,
    guardianId: e.guardianPatientId,
    person: { name: p.name, birthDate: p.birthDate, cpf: p.cpf },
    state: e.state,
    originalEntryDate: e.originalEntryDate.getTime(),
    classification: e.classification,
    confirmedRisk: e.confirmedRisk,
    priority: e.priority,
    reassigned: e.reassigned,
    refusals: e.refusals,
    sessionId: e.sessionId,
    allocatedAt: ms(e.allocatedAt),
    askedAt: ms(e.askedAt),
    answeredAt: ms(e.answeredAt),
    archivedAt: ms(e.archivedAt),
    refusedSessions: e.refusedSessions,
  };
}

const withPerson = (db: TenantDatabase) =>
  db.select({ e: entry, p: localPerson }).from(entry).innerJoin(localPerson, eq(entry.localPersonId, localPerson.id));

export async function readEntry(db: TenantDatabase, id: string): Promise<Entry | null> {
  const [row] = await withPerson(db).where(eq(entry.id, id));
  return row ? forEntry(row) : null;
}

/** Várias entradas numa consulta só (sem uma ida ao banco por entrada). */
export async function readEntries(db: TenantDatabase, ids: string[]): Promise<Entry[]> {
  if (ids.length === 0) return [];
  return (await withPerson(db).where(inArray(entry.id, ids))).map(forEntry);
}

export async function serviceActiveEntries(db: TenantDatabase, serviceId: string): Promise<Entry[]> {
  const rows = await withPerson(db).where(
    and(eq(entry.serviceId, serviceId), notInArray(entry.state, [...FINAL_STATES])),
  );
  return rows.map(forEntry);
}

export type CmdJoinWaitlist = {
  serviceId: string;
  person: InformedPerson;
  guardianPatientId: string | null;
  answers: Answers;
  now: number;
};

async function enter(tx: TenantDatabase, cmd: CmdJoinWaitlist): Promise<Result<Entry>> {
  const [row] = await tx
    .select({ s: service, u: unit })
    .from(service)
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(eq(service.id, cmd.serviceId));
  if (!row) throw new ApiError(404, "not_found");
  const config = { ...effectiveConfig({ municipality: {}, unit: row.u.config }), timeZone: row.u.timeZone };
  const active = await serviceActiveEntries(tx, cmd.serviceId);
  const r = createEntry(
    active,
    {
      service: { id: row.s.id, mode: row.s.mode, requiresTriage: row.s.requiresTriage },
      person: { name: cmd.person.name, birthDate: cmd.person.birthDate, cpf: cmd.person.cpf },
      guardianId: cmd.guardianPatientId,
      answers: cmd.answers,
      id: randomUUID(),
    },
    cmd.now,
    config,
  );
  if (!r.ok) return r;
  const { id } = await attendedPerson(tx, cmd.person);
  await insertEntry(tx, r.state, id, cmd.person.relationship ?? null);
  return r;
}

// RN-LE-01 / RN-LE-05: a entrada na lista que a rota do app e a do balcão chamam. Numa transação.
export async function joinWaitlist(db: TenantDb | TenantTx, cmd: CmdJoinWaitlist): Promise<Result<Entry>> {
  if (db instanceof PgTransaction) return enter(db, cmd);
  return db.transaction((tx) => enter(tx, cmd));
}

// O que o domínio pode mudar numa entrada existente (a pessoa e a data original nunca mudam, INV-09).
export async function updateEntry(db: TenantDatabase, e: Entry): Promise<void> {
  await db
    .update(entry)
    .set({
      state: e.state,
      classification: e.classification,
      confirmedRisk: e.confirmedRisk,
      priority: e.priority,
      reassigned: e.reassigned,
      refusals: e.refusals,
      sessionId: e.sessionId,
      allocatedAt: data(e.allocatedAt),
      askedAt: data(e.askedAt),
      answeredAt: data(e.answeredAt),
      archivedAt: data(e.archivedAt),
      refusedSessions: e.refusedSessions,
    })
    .where(eq(entry.id, e.id));
}

export async function sessionEntries(db: TenantDatabase, sessionId: string): Promise<Entry[]> {
  const rows = await withPerson(db).where(eq(entry.sessionId, sessionId));
  return rows.map(forEntry);
}

/**
 * Trava a linha da entrada (`for update`) e a lê já com o estado gravado por quem tinha a trava antes.
 * Dentro de `inSession`, sempre depois da trava da sessão (mesma ordem em todo caminho: sem deadlock).
 */
export async function lockEntry(tx: TenantDatabase, id: string): Promise<Entry> {
  const [row] = await tx.select({ id: entry.id }).from(entry).where(eq(entry.id, id)).for("update");
  if (!row) throw new ApiError(404, "not_found");
  const e = await readEntry(tx, id);
  if (!e) throw new ApiError(404, "not_found");
  return e;
}
