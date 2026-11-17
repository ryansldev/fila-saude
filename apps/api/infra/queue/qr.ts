import { type Action, checkIn, type PendingCheck, tokenQr, validateQr } from "@fila-saude/domain";
import type { CheckIn, UnitQr } from "@fila-saude/schemas/queue";
import { and, eq, inArray } from "drizzle-orm";
import type { AuthenticatedPatient } from "infra/auth/patient-session";
import { requireUnit } from "infra/config/common";
import { entry } from "infra/database/municipal/schema/entry";
import { localPerson } from "infra/database/municipal/schema/local-person";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import type { TenantDatabase, TenantDb } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import type { ActionContext } from "infra/panel/action";
import { conditionsInUnit } from "infra/panel/guard";
import { inSession } from "./day";

// Quem cuida da tela do QR na recepção (até a TV pareada da fatia 2).
const QR_ACTIONS: Action[] = ["verify_and_mark_attendance", "open_cancel_close_session"];

/** As sessões abertas da unidade com o dia e o segredo do QR (a TV e a tela do QR leem daqui). */
export async function unitOpen(db: TenantDatabase, unitId: string) {
  return db
    .select({ id: session.id, service: service.name, secret: sessionDay.qrSecret, day: sessionDay.day })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .innerJoin(sessionDay, eq(sessionDay.sessionId, session.id))
    .where(and(eq(service.unitId, unitId), eq(session.state, "open")));
}

const intervalOf = (open: Awaited<ReturnType<typeof unitOpen>>) => (open[0]?.day.config.qrSeconds ?? 30) * 1000;

// RN-PRES-01: um link com o token de cada sessão aberta; o app abre direto pela câmera do celular.
// Sem checar quem pede: a tela do QR no painel e a TV pareada (RN-TV-02) checam antes.
export async function qrContent(db: TenantDatabase, slug: string, unitId: string, now: number): Promise<UnitQr> {
  return qrFromOpen(await unitOpen(db, unitId), slug, unitId, now);
}

/** O QR a partir das sessões abertas já lidas (a TV não lê os dias duas vezes). */
export async function qrFromOpen(
  rows: Awaited<ReturnType<typeof unitOpen>>,
  slug: string,
  unitId: string,
  now: number,
): Promise<UnitQr> {
  const open = rows.filter((s) => s.secret !== null);
  const interval = intervalOf(open);
  if (open.length === 0)
    return {
      content: null,
      intervalSeconds: interval / 1000,
      expiresAt: null,
      now: new Date(now).toISOString(),
      sessions: [],
    };
  const tokens = await Promise.all(open.map((s) => tokenQr(s.secret as string, now, interval)));
  const url = new URL("filasaude://check-in");
  url.searchParams.set("m", slug);
  url.searchParams.set("u", unitId);
  url.searchParams.set("t", tokens.join(","));
  return {
    content: url.toString(),
    intervalSeconds: interval / 1000,
    expiresAt: new Date((Math.floor(now / interval) + 1) * interval).toISOString(),
    now: new Date(now).toISOString(),
    sessions: open.map((s) => ({ id: s.id, service: s.service })),
  };
}

export async function unitQr(ctx: ActionContext, slug: string, unitId: string): Promise<UnitQr> {
  await requireUnit(ctx.db, unitId);
  if (!QR_ACTIONS.some((a) => conditionsInUnit(ctx.actor.profiles, a, unitId) !== null)) {
    throw new ApiError(403, "no_permission");
  }
  return qrContent(ctx.db, slug, unitId, ctx.now);
}

// RN-PRES-01 + RN-FILA-05: o paciente leu o QR; cada pessoa da conta nas sessões do QR entra presente,
// ou fica remota com as pendências que só a recepção resolve.
export async function patientCheckIn(
  db: TenantDb,
  p: AuthenticatedPatient,
  unitId: string,
  tokens: string[],
  now: number,
): Promise<CheckIn> {
  const open = (await unitOpen(db, unitId)).filter((s) => s.secret !== null);
  const interval = intervalOf(open);
  const valid: string[] = [];
  for (const s of open) {
    for (const t of tokens) {
      if ((await validateQr([s.secret as string], t, now, interval)) !== null) {
        valid.push(s.id);
        break;
      }
    }
  }
  if (valid.length === 0) throw new ApiError(409, "invalid_qr", undefined, "QR vencido. Leia de novo o QR da unidade.");

  const people = await db
    .select({
      id: entry.id,
      name: localPerson.name,
      patientId: localPerson.patientId,
      verified: localPerson.documentVerifiedAt,
    })
    .from(entry)
    .innerJoin(localPerson, eq(entry.localPersonId, localPerson.id))
    .where(and(eq(entry.guardianPatientId, p.patientId), inArray(entry.sessionId, valid)));
  const exit: CheckIn = [];
  for (const sessionId of valid) {
    await inSession(db, sessionId, async (c) => {
      if (!c.day) return { result: null };
      let day = c.day;
      for (const person of people) {
        const item = day.items.find((i) => i.entryId === person.id);
        if (!item) continue;
        const base = { entryId: person.id, person: person.name, ticket: item.ticket };
        if (item.state !== "remote") {
          if (item.state === "present") exit.push({ ...base, result: "already_in_unit", pendingChecks: [] });
          // Já chamado: a pessoa precisa ir para a sala, não ouvir "você não tem senha".
          if (item.state === "called") exit.push({ ...base, result: "called", pendingChecks: [] });
          continue;
        }
        const owner = person.patientId === p.patientId;
        const pendingChecks: PendingCheck[] = [];
        if (owner && !p.verified) pendingChecks.push("account");
        if (!owner && person.verified === null) pendingChecks.push("attended_person");
        const withPendingChecks = {
          ...day,
          items: day.items.map((i) => (i.id === item.id ? { ...i, pendingChecks } : i)),
        };
        const r = checkIn(withPendingChecks, { itemId: item.id }, now);
        if (r.ok) {
          day = r.state;
          exit.push({ ...base, result: "present", pendingChecks: [] });
        } else if (r.error === "pending_check") {
          day = withPendingChecks;
          const effective = [...pendingChecks];
          if (effective.length === 0) effective.push("priority");
          exit.push({ ...base, result: "pending_check", pendingChecks: effective });
        }
        // Outro motivo (ex.: chamado agora): essa pessoa fica como está e as demais seguem; um erro
        // aqui desfaria a resposta das sessões já gravadas.
      }
      return { day, result: null };
    });
  }
  return exit;
}
