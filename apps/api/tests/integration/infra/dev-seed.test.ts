import { and, eq, inArray, sql } from "drizzle-orm";
import database from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { municipality } from "infra/database/central/schema/municipality";
import { audit } from "infra/database/municipal/schema/audit";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { station } from "infra/database/municipal/schema/station";
import { unit } from "infra/database/municipal/schema/unit";
import env from "infra/env";
import { EXAMPLE_CPFS, type ExampleSummary, seedExample } from "infra/example/seed";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-11-11 23:30 em Brasília: "amanhã" é 12/11 no fuso da unidade, embora já seja 12/11 em UTC.
const NOW = Date.parse("2026-11-11T23:30:00-03:00");
let slug: string;
let summary: ExampleSummary;

const deps = () => ({ central: database, template: env.TENANT_DATABASE_URL_TEMPLATE, now: NOW, slug });
const db = () => orchestrator.municipalityDatabase(slug);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  slug = orchestrator.uniqueSlug();
  summary = await seedExample(deps());
}, 60_000);
afterAll(() => orchestrator.dropMunicipalities());

async function counts() {
  return {
    units: (await db().select().from(unit)).length,
    services: (await db().select().from(service)).length,
    stations: (await db().select().from(station)).length,
    sessions: (await db().select().from(session)).length,
    entries: (await db().select().from(entry)).length,
  };
}

describe("dev:seed", () => {
  it("exemplo: unidade, três serviços (um com triagem), quatro estações e cinco sessões", async () => {
    expect(await counts()).toEqual({ units: 4, services: 3, stations: 4, sessions: 5, entries: 9 });
    const services = await db().select().from(service);
    expect(services.filter((s) => s.requiresTriage)).toHaveLength(1);
  });

  it("exemplo: amanhã é no fuso da unidade", async () => {
    const sessions = await db().select().from(session);
    const publicOne = sessions.find((s) => s.visibility === "public");
    const privateOne = sessions
      .filter((s) => s.visibility === "private")
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    expect(publicOne?.start.toISOString()).toBe("2026-11-12T11:00:00.000Z");
    expect(privateOne?.start.toISOString()).toBe("2026-11-12T16:00:00.000Z");
    expect(summary.sessions.map((s) => s.localStart).sort()).toEqual([
      "2026-11-11T23:00",
      "2026-11-11T23:00",
      "2026-11-12T08:00",
      "2026-11-12T13:00",
      "2026-11-14T13:00",
    ]);
  });

  it("fatia 1: sessão pública de agora (hora cheia, 4 h) em serviço sem triagem, com Ana e Bruno inscritos", async () => {
    const [now] = await db()
      .select()
      .from(session)
      .where(eq(session.start, new Date("2026-11-12T02:00:00.000Z")));
    expect(now).toMatchObject({ visibility: "public", state: "planned", taken: 2 });
    expect(now?.end.toISOString()).toBe("2026-11-12T06:00:00.000Z");
    const signedUp = await db()
      .select()
      .from(entry)
      .where(eq(entry.sessionId, now?.id as string));
    expect(signedUp.map((e) => e.state)).toEqual(["confirmed", "confirmed"]);
  });

  it("fatia 3: Clínico geral de agora com triagem (Triagem 1 e Consultório 1) e três inscritos com riscos sugeridos diferentes", async () => {
    const [general] = await db().select().from(service).where(eq(service.requiresTriage, true));
    const [now] = await db()
      .select()
      .from(session)
      .where(
        and(eq(session.serviceId, general?.id as string), eq(session.start, new Date("2026-11-12T02:00:00.000Z"))),
      );
    expect(now).toMatchObject({ visibility: "public", state: "planned", taken: 3 });
    const signedUp = await db()
      .select()
      .from(entry)
      .where(eq(entry.sessionId, now?.id as string));
    expect(signedUp.map((e) => e.classification.level).sort()).toEqual(["attention", "routine", "urgent"]);
  });

  it("fatia 4: Carla com urgência sugerida na Odontologia; outra privada em 3 dias com Bruno alocado há 30 h", async () => {
    const [dental] = await db().select().from(service).where(eq(service.prefix, "O"));
    const fromDental = await db()
      .select()
      .from(entry)
      .where(eq(entry.serviceId, dental?.id as string));
    const urgent = fromDental.filter((e) => e.classification.level === "urgent");
    expect(urgent).toHaveLength(1);
    const allocated = fromDental.filter((e) => e.state === "allocated");
    expect(allocated).toHaveLength(1);
    expect(allocated[0]?.allocatedAt?.getTime()).toBe(NOW - 30 * 3600_000);
    const [s] = await db()
      .select()
      .from(session)
      .where(eq(session.id, allocated[0]?.sessionId as string));
    expect(s).toMatchObject({ visibility: "private", taken: 1 });
    expect(s?.start.toISOString()).toBe("2026-11-14T16:00:00.000Z");
  });

  it("exemplo: cada pessoa da equipe loga no painel com os seus papéis", async () => {
    const expected: Record<string, string[]> = {
      gestor: ["sms_management"],
      regulacao: ["sms_regulation"],
      gerente: ["unit_manager"],
      recepcao: ["reception", "scheduler"],
      enfermeira: ["nurse"],
      tecnica: ["nursing_technician"],
      medica: ["care"],
      dentista: ["care"],
    };
    expect(summary.users.map((u) => u.login).sort()).toEqual(Object.keys(expected).sort());
    for (const u of summary.users) {
      const cookie = await orchestrator.loginStaff(slug, u.login, u.password);
      const me = await orchestrator.panelRequest(slug, "GET", "/v1/panel/me", { cookie });
      expect(me.body.profiles.map((p: { profile: string }) => p.profile)).toEqual(expected[u.login]);
    }
  });

  it("exemplo: pacientes logam na central e há 4 entradas aguardando na Odontologia", async () => {
    for (const p of summary.patients) {
      const r = await fetch(`${webserver.origin}/v1/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: webserver.origin },
        body: JSON.stringify({ username: p.cpf, password: p.password }),
      });
      expect(r.status).toBe(200);
    }
    const [dental] = await db().select().from(service).where(eq(service.prefix, "O"));
    const entries = await db()
      .select()
      .from(entry)
      .where(eq(entry.serviceId, dental?.id as string));
    expect(entries.filter((e) => e.state === "waiting")).toHaveLength(3);
  });

  it("PD-40 / RN-PERF-04: auditoria atribuída a quem fez (SMS → gerente → equipe); nenhuma linha para as entradas dos pacientes", async () => {
    const id = (login: string) => summary.users.find((u) => u.login === login)?.id;
    const rows = await db().select().from(audit);
    const by = (login: string) =>
      rows
        .filter((l) => l.userId === id(login))
        .map((l) => l.targetKind)
        .sort();
    expect(by("gestor")).toEqual(["unit", "unit", "unit", "unit", "user", "user"]);
    expect(by("gerente")).toEqual([
      ...Array(3).fill("service"),
      ...Array(5).fill("session"),
      ...Array(4).fill("station"),
      ...Array(5).fill("user"),
    ]);
    expect(by("recepcao")).toEqual(["entry", "entry"]);
    expect(rows).toHaveLength(25); // + 3 unidades vizinhas (tela 5), a triagem e a fatia 4
  });

  it("PD-40: rodar de novo apaga e recria — mesmas contagens, ids novos, sessão antiga inválida", async () => {
    const cookie = await orchestrator.loginStaff(slug, "gestor", "exemplo123");
    const [before] = await db().select().from(unit);
    await orchestrator.forgetDatabase(slug);
    summary = await seedExample(deps());
    const [after] = await db().select().from(unit);
    expect(after?.id).not.toBe(before?.id);
    expect(await counts()).toEqual({ units: 4, services: 3, stations: 4, sessions: 5, entries: 9 });
    expect((await orchestrator.panelRequest(slug, "GET", "/v1/panel/me", { cookie })).status).toBe(401);
    const fresh = await orchestrator.loginStaff(slug, "gestor", "exemplo123");
    expect((await orchestrator.panelRequest(slug, "GET", "/v1/panel/me", { cookie: fresh })).status).toBe(200);
  }, 60_000);

  it("PD-40: depois de uma execução interrompida (município em criando, pacientes no central), termina", async () => {
    await database.update(municipality).set({ status: "creating" }).where(eq(municipality.slug, slug));
    const cpfs = EXAMPLE_CPFS;
    expect((await database.select().from(patient).where(inArray(patient.cpf, cpfs))).length).toBe(3);
    await orchestrator.forgetDatabase(slug);
    summary = await seedExample(deps());
    const [row] = await database.select().from(municipality).where(eq(municipality.slug, slug));
    expect(row?.status).toBe("active");
    expect(await counts()).toEqual({ units: 4, services: 3, stations: 4, sessions: 5, entries: 9 });
    const r = await database.execute<{ n: number }>(sql`select count(*)::int as n from patient where email_verified`);
    expect(r.rows[0]?.n).toBeGreaterThanOrEqual(3);
  }, 60_000);
});
