import { type Assignments, assignmentUnitKey, canRegister, staffProblems } from "@fila-saude/domain";
import type { AssignmentsInput, StaffUser, StaffUserInput } from "@fila-saude/schemas/user";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createStaffUser } from "infra/auth/panel";
import { panelAccount, panelSession, staffUser } from "infra/database/municipal/schema/auth";
import { userRole } from "infra/database/municipal/schema/staff";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { assignmentsOf, grantAssignments, replaceAssignments, userAssignments } from "infra/panel/profiles";
import { STAFF } from "./common";

const MANAGER_CAVEAT = "da própria unidade, sem função de gestão";

// Forma (escopo de cada função, ao menos uma atribuição) e unidades existentes no tenant.
async function validateAssignments(db: TenantDatabase, a: AssignmentsInput): Promise<Assignments> {
  const fields: Record<string, string[]> = Object.fromEntries(
    Object.entries(staffProblems(a)).map(([k, v]) => [k, [v]]),
  );
  const ids = [
    ...new Set([...a.unitLinks.map((v) => v.unitId), ...a.roles.map((f) => f.unitId)].filter((x) => x !== null)),
  ] as string[];
  if (ids.length > 0) {
    const found = new Set(
      // Unidade removida (arquivada) não recebe ninguém (R1).
      (
        await db
          .select({ id: unit.id })
          .from(unit)
          .where(and(inArray(unit.id, ids), isNull(unit.archivedAt)))
      ).map((u) => u.id),
    );
    a.unitLinks.forEach((v, i) => {
      if (!found.has(v.unitId)) fields[assignmentUnitKey("unitLinks", i)] = ["unidade não encontrada"];
    });
    a.roles.forEach((f, i) => {
      if (f.unitId && !found.has(f.unitId)) fields[assignmentUnitKey("roles", i)] = ["unidade não encontrada"];
    });
  }
  if (Object.keys(fields).length > 0) throw new ApiError(400, "invalid_input", fields);
  return a;
}

// A unidade em que o guard confere o gerente: a primeira com atribuição; sem nenhuma, só o município conta.
function targetUnit(...targets: Assignments[]): string | null {
  for (const a of targets) {
    const u = a.unitLinks[0]?.unitId ?? a.roles.find((f) => f.unitId)?.unitId;
    if (u) return u;
  }
  return null;
}

async function userWithAssignments(db: TenantDatabase, id: string): Promise<StaffUser> {
  const [u] = await db
    .select()
    .from(staffUser)
    .where(and(eq(staffUser.id, id), isNull(staffUser.removedAt)));
  if (!u) throw new ApiError(404, "not_found");
  return { id: u.id, login: u.username ?? "", name: u.name, ...(await userAssignments(db, id)) };
}

// RN-PERF-04: quem cria quem passa pela matriz (gestão SMS livre; gerente com a ressalva) e por `canRegister`.
export async function createUser(ctx: ActionContext, data: StaffUserInput): Promise<StaffUser> {
  const target = await validateAssignments(ctx.db, data);
  const actor = await userAssignments(ctx.db, ctx.actor.userId);
  return runAction(
    ctx,
    {
      action: STAFF,
      target: { kind: "user", id: (u) => u.id },
      unitId: targetUnit(target),
      caveats: { [MANAGER_CAVEAT]: () => canRegister(actor, target) },
      data: (u) => ({ unitLinks: u.unitLinks, roles: u.roles }),
    },
    async (tx) => {
      if (!canRegister(actor, target)) throw new ApiError(403, "no_permission");
      const { id } = await createStaffUser(tx, { login: data.login, name: data.name, password: data.password });
      await grantAssignments(tx, id, target, ctx.actor.userId);
      return userWithAssignments(tx, id);
    },
  );
}

// Gestão SMS vê todos; o gerente, quem tem alguma atribuição nas unidades dele; os outros, ninguém.
export async function listUsers(ctx: ActionContext): Promise<StaffUser[]> {
  const actor = await userAssignments(ctx.db, ctx.actor.userId);
  const sms = actor.roles.some((f) => f.role === "sms_management");
  const manages = new Set(actor.roles.filter((f) => f.role === "unit_manager").map((f) => f.unitId));
  if (!sms && manages.size === 0) throw new ApiError(403, "no_permission");
  const users = await ctx.db
    .select()
    .from(staffUser)
    .where(isNull(staffUser.removedAt))
    .orderBy(asc(staffUser.createdAt));
  const assignments = await assignmentsOf(
    ctx.db,
    users.map((u) => u.id),
  );
  const all: StaffUser[] = users.map((u) => ({
    id: u.id,
    login: u.username ?? "",
    name: u.name,
    ...(assignments.get(u.id) ?? { unitLinks: [], roles: [] }),
  }));
  if (sms) return all;
  return all.filter(
    (u) => u.unitLinks.some((v) => manages.has(v.unitId)) || u.roles.some((f) => manages.has(f.unitId)),
  );
}

// Tira a Gestão SMS de alguém só se sobrar outra. A trava de transação põe em fila as remoções
// simultâneas: sem ela, os dois últimos gestores removendo um ao outro veriam dois cada um.
async function requireAnotherManager(db: TenantDatabase) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('fila-saude:last-manager'))`);
  const sms = await db
    .selectDistinct({ id: userRole.userId })
    .from(userRole)
    .where(eq(userRole.role, "sms_management"));
  if (sms.length <= 1) throw new ApiError(409, "last_manager");
}

// RN-PERF-04: o ator precisa poder cadastrar a pessoa como ela está e como vai ficar.
export async function switchAssignments(
  ctx: ActionContext,
  userId: string,
  fresh: AssignmentsInput,
): Promise<StaffUser> {
  const current = await userWithAssignments(ctx.db, userId);
  const target = await validateAssignments(ctx.db, fresh);
  const actor = await userAssignments(ctx.db, ctx.actor.userId);
  const can = () => canRegister(actor, current) && canRegister(actor, target);
  return runAction(
    ctx,
    {
      action: STAFF,
      target: { kind: "user", id: userId },
      unitId: targetUnit(current, target),
      caveats: { [MANAGER_CAVEAT]: can },
      data: (u) => ({ unitLinks: u.unitLinks, roles: u.roles }),
    },
    async (tx) => {
      if (!can()) throw new ApiError(403, "no_permission");
      const wasSms = current.roles.some((f) => f.role === "sms_management");
      if (wasSms && !target.roles.some((f) => f.role === "sms_management")) await requireAnotherManager(tx);
      await replaceAssignments(tx, userId, target, ctx.actor.userId);
      return userWithAssignments(tx, userId);
    },
  );
}

// Remover da equipe: quem pode cadastrar a pessoa pode removê-la (RN-PERF-04). Ela perde a senha, as
// sessões e as atribuições; o registro fica, marcado, para a auditoria e para o login não ser reusado.
export async function removeUser(ctx: ActionContext, userId: string): Promise<void> {
  if (userId === ctx.actor.userId) throw new ApiError(409, "remove_self");
  const current = await userWithAssignments(ctx.db, userId);
  const actor = await userAssignments(ctx.db, ctx.actor.userId);
  const can = () => canRegister(actor, current);
  await runAction(
    ctx,
    {
      action: STAFF,
      target: { kind: "user", id: userId },
      unitId: targetUnit(current),
      caveats: { [MANAGER_CAVEAT]: can },
      data: () => ({ removed: true }),
    },
    async (tx) => {
      if (!can()) throw new ApiError(403, "no_permission");
      if (current.roles.some((f) => f.role === "sms_management")) await requireAnotherManager(tx);
      await replaceAssignments(tx, userId, { unitLinks: [], roles: [] }, ctx.actor.userId);
      await tx.delete(panelSession).where(eq(panelSession.userId, userId));
      await tx.delete(panelAccount).where(eq(panelAccount.userId, userId));
      await tx
        .update(staffUser)
        .set({ removedAt: new Date(ctx.now) })
        .where(eq(staffUser.id, userId));
    },
  );
}
