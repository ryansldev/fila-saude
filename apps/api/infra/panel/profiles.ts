import { type Assignments, type Profile, rolesOf } from "@fila-saude/domain";
import { asc, eq, inArray } from "drizzle-orm";
import { unitLink, userRole } from "infra/database/municipal/schema/staff";
import type { TenantDatabase } from "infra/database/tenants";

export type PanelProfile = Exclude<Profile, "patient">;
/** Papel de permissão com escopo (o que o guard confere), derivado das atribuições. */
export type ScopedProfile = { profile: PanelProfile; unitId: string | null };

// Ocupações e funções gravadas da pessoa (RN-PERF-04).
export async function userAssignments(db: TenantDatabase, userId: string): Promise<Assignments> {
  const unitLinks = await db
    .select({ unitId: unitLink.unitId, occupation: unitLink.occupation })
    .from(unitLink)
    .where(eq(unitLink.userId, userId))
    .orderBy(asc(unitLink.grantedAt), asc(unitLink.occupation));
  const roles = await db
    .select({ role: userRole.role, unitId: userRole.unitId })
    .from(userRole)
    .where(eq(userRole.userId, userId))
    .orderBy(asc(userRole.grantedAt), asc(userRole.role));
  return { unitLinks, roles };
}

/** As atribuições de várias pessoas em duas consultas (a tela Equipe lista todo o município). */
export async function assignmentsOf(db: TenantDatabase, userIds: string[]): Promise<Map<string, Assignments>> {
  const byUser = new Map<string, Assignments>(userIds.map((id) => [id, { unitLinks: [], roles: [] }]));
  if (userIds.length === 0) return byUser;
  const links = await db
    .select({ userId: unitLink.userId, unitId: unitLink.unitId, occupation: unitLink.occupation })
    .from(unitLink)
    .where(inArray(unitLink.userId, userIds))
    .orderBy(asc(unitLink.grantedAt), asc(unitLink.occupation));
  const roles = await db
    .select({ userId: userRole.userId, role: userRole.role, unitId: userRole.unitId })
    .from(userRole)
    .where(inArray(userRole.userId, userIds))
    .orderBy(asc(userRole.grantedAt), asc(userRole.role));
  for (const { userId, ...v } of links) byUser.get(userId)?.unitLinks.push(v);
  for (const { userId, ...f } of roles) byUser.get(userId)?.roles.push(f);
  return byUser;
}

// Acrescenta atribuições (as repetidas são ignoradas).
export async function grantAssignments(
  db: TenantDatabase,
  userId: string,
  a: Assignments,
  grantedBy: string | null,
): Promise<void> {
  if (a.unitLinks.length > 0) {
    await db
      .insert(unitLink)
      .values(a.unitLinks.map((v) => ({ userId, unitId: v.unitId, occupation: v.occupation, grantedBy })))
      .onConflictDoNothing();
  }
  if (a.roles.length > 0) {
    await db
      .insert(userRole)
      .values(a.roles.map((f) => ({ userId, role: f.role, unitId: f.unitId, grantedBy })))
      .onConflictDoNothing();
  }
}

export async function replaceAssignments(
  db: TenantDatabase,
  userId: string,
  a: Assignments,
  grantedBy: string | null,
): Promise<void> {
  await db.delete(unitLink).where(eq(unitLink.userId, userId));
  await db.delete(userRole).where(eq(userRole.userId, userId));
  await grantAssignments(db, userId, a, grantedBy);
}

export async function userProfiles(db: TenantDatabase, userId: string): Promise<ScopedProfile[]> {
  return rolesOf(await userAssignments(db, userId)) as ScopedProfile[];
}
