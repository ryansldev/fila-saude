import { createHash, randomBytes, randomInt } from "node:crypto";
import type { TvRecord, TvState, UnitTv } from "@fila-saude/schemas/tv";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { CONFIGURE, requireUnit } from "infra/config/common";
import { station } from "infra/database/municipal/schema/station";
import { tv } from "infra/database/municipal/schema/tv";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase, TenantDb } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { unitConfig } from "infra/queue/day";
import { qrFromOpen, unitOpen } from "infra/queue/qr";

const CODE_VALIDITY_MS = 15 * 60_000;
const ONLINE_MS = 60_000;
const SIGNAL_MS = 20_000;
const LAST = 5;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// PD-47 / RN-TV-01: a TV se registra sozinha; o código só vale enquanto ninguém o usou e não venceu.
// Dois códigos pendentes iguais deixariam o admin parear a TV errada: sorteia de novo.
export async function registerTv(db: TenantDb, now: number): Promise<TvRecord> {
  const token = randomBytes(32).toString("base64url");
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const [equal] = await db
      .select({ id: tv.id })
      .from(tv)
      .where(and(eq(tv.code, code), ...pending(now)))
      .limit(1);
    if (equal) continue;
    await db.insert(tv).values({ code, tokenHash: hash(token), createdAt: new Date(now) });
    return { code, token };
  }
  throw new ApiError(503, "try_again");
}

const pending = (now: number) => [
  isNull(tv.unitId),
  isNull(tv.revokedAt),
  gt(tv.createdAt, new Date(now - CODE_VALIDITY_MS)),
];

async function tokenTv(db: TenantDatabase, token: string | null) {
  if (!token) throw new ApiError(401, "tv_not_paired");
  const [row] = await db
    .select()
    .from(tv)
    .where(eq(tv.tokenHash, hash(token)));
  if (!row || row.revokedAt) throw new ApiError(401, "tv_not_paired");
  return row;
}

export async function pairTv(ctx: ActionContext, unitId: string, code: string): Promise<{ id: string }> {
  await requireUnit(ctx.db, unitId);
  return runAction(ctx, { action: CONFIGURE, target: { kind: "tv", id: (r) => r.id }, unitId }, async (tx) => {
    const [row] = await tx
      .update(tv)
      .set({ unitId, pairedAt: new Date(ctx.now) })
      .where(and(eq(tv.code, code), ...pending(ctx.now)))
      .returning({ id: tv.id });
    if (!row) throw new ApiError(404, "invalid_code", undefined, "Código não encontrado ou vencido.");
    return row;
  });
}

export async function unitTvs(ctx: ActionContext, unitId: string): Promise<UnitTv[]> {
  const rows = await ctx.db
    .select()
    .from(tv)
    .where(and(eq(tv.unitId, unitId), isNull(tv.revokedAt), isNotNull(tv.pairedAt)));
  return rows.map((t) => ({
    id: t.id,
    pairedAt: (t.pairedAt as Date).toISOString(),
    lastSignalAt: t.lastSignalAt?.toISOString() ?? null,
    online: t.lastSignalAt !== null && ctx.now - t.lastSignalAt.getTime() < ONLINE_MS,
  }));
}

export async function revokeTv(ctx: ActionContext, tvId: string): Promise<{ id: string }> {
  const [t] = await ctx.db.select().from(tv).where(eq(tv.id, tvId));
  if (!t?.unitId || t.revokedAt) throw new ApiError(404, "not_found");
  return runAction(ctx, { action: CONFIGURE, target: { kind: "tv", id: tvId }, unitId: t.unitId }, async (tx) => {
    await tx
      .update(tv)
      .set({ revokedAt: new Date(ctx.now) })
      .where(eq(tv.id, tvId));
    return { id: tvId };
  });
}

// RN-TV-02..07: só a unidade pareada; só senhas, destino e números.
export async function tvScreen(db: TenantDb, slug: string, token: string | null, now: number): Promise<TvState> {
  const t = await tokenTv(db, token);
  // RN-TV-06: sinal de vida, gravado no máximo a cada 20 s.
  await db
    .update(tv)
    .set({ lastSignalAt: new Date(now) })
    .where(and(eq(tv.id, t.id), or(isNull(tv.lastSignalAt), lt(tv.lastSignalAt, new Date(now - SIGNAL_MS)))));
  if (!t.unitId) {
    // O servidor decide a validade (o relógio da TV pode estar errado): vencido, a TV se registra de novo.
    if (t.createdAt.getTime() + CODE_VALIDITY_MS <= now) throw new ApiError(401, "tv_not_paired");
    return {
      state: "waiting",
      code: t.code,
      expiresAt: new Date(t.createdAt.getTime() + CODE_VALIDITY_MS).toISOString(),
    };
  }
  const [u] = await db.select().from(unit).where(eq(unit.id, t.unitId));
  if (!u || u.archivedAt) throw new ApiError(401, "tv_not_paired");

  const open = await unitOpen(db, u.id);
  const stationIds = [...new Set(open.flatMap(({ day }) => day.calls.map((c) => c.stationId)))];
  const names = new Map(
    stationIds.length === 0
      ? []
      : (
          await db.select({ id: station.id, name: station.name }).from(station).where(inArray(station.id, stationIds))
        ).map((e) => [e.id, e.name]),
  );

  const calls = open
    .flatMap(({ day }) =>
      // RN-CHAM-02: cada rechamada é um anúncio novo.
      day.calls.flatMap((c) =>
        [c.at, ...(c.recalls ?? [])].map((at) => ({
          id: `${c.itemId}:${at}`,
          ticket: day.items.find((i) => i.id === c.itemId)?.ticket ?? "",
          destination: names.get(c.stationId) ?? "",
          at,
        })),
      ),
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, LAST)
    .map((c) => ({ ...c, at: new Date(c.at).toISOString() }));

  const byService = new Map<string, { waiting: number; onTheWay: number }>();
  for (const { service: name, day } of open) {
    const current = byService.get(name) ?? { waiting: 0, onTheWay: 0 };
    current.waiting += day.items.filter((i) => i.state === "present").length;
    current.onTheWay += day.items.filter((i) => i.state === "remote").length;
    byService.set(name, current);
  }

  const qr = await qrFromOpen(open, slug, u.id, now);
  return {
    state: "paired",
    unit: { id: u.id, name: u.name },
    highlightSeconds: unitConfig(u).tvHighlightSeconds,
    calls,
    services: [...byService].map(([name, n]) => ({ name, ...n })).sort((a, b) => a.name.localeCompare(b.name)),
    qr: qr.content && qr.expiresAt ? { content: qr.content, expiresAt: qr.expiresAt } : null,
    careStarted: open.some(({ day }) => day.stations.some((e) => e.open)),
  };
}
