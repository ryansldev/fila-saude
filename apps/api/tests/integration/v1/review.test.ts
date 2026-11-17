import { eq } from "drizzle-orm";
import database from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { entry } from "infra/database/municipal/schema/entry";
import { tv } from "infra/database/municipal/schema/tv";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation, unitManagerRoles } from "tests/panel";
import { queueScenario, ROUTINE, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Revisão de 2026-11-13: cada caso aqui era um bug encontrado na revisão de todas as fatias.

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;

async function app(method: string, path: string, cookie?: string, body?: unknown) {
  const r = await fetch(`${webserver.origin}${path}`, {
    method: method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
const m = () => `/v1/municipalities/${c.slug}`;
const session = (start: number, end: number, stations = [c.e1]) =>
  c.request("POST", `/v1/panel/units/${c.unitId}/sessions`, c.admin, {
    serviceId: c.serviceId,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    slots: 10,
    visibility: "public",
    waivesPreRegistration: false,
    professional: null,
    stations,
  });

// Não há GET de uma sessão: a versão vem da lista da unidade.
async function readSession(id: string) {
  const from = new Date(Date.now() - 5 * 86400_000).toISOString();
  const until = new Date(Date.now() + 5 * 86400_000).toISOString();
  const r = await c.request("GET", `/v1/panel/units/${c.unitId}/sessions?from=${from}&until=${until}`, c.admin);
  return (r.body as { id: string; version: number; taken: number }[]).find((s) => s.id === id);
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
});
afterAll(() => orchestrator.dropMunicipalities());

describe("identidade (CPF e nascimento)", () => {
  it("'outra pessoa' com o CPF de alguém já cadastrado e outros dados → person_mismatch, sem vazar o nome", async () => {
    const victim = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Vera Lúcia" }));
    await app("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, victim.cookie, {
      forWhom: { kind: "me" },
      answers: ROUTINE,
    });
    const attacker = await orchestrator.loginPatient();
    const r = await app("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, attacker.cookie, {
      forWhom: {
        kind: "other",
        relationship: "legal_guardian",
        declared: true,
        name: "Qualquer Um",
        birthDate: "2000-01-01",
        cpf: victim.data.cpf,
      },
      answers: ROUTINE,
    });
    // A vítima tem conta: a recusa vem antes, sem conferir dados (2026-11-14).
    expect(r).toMatchObject({ status: 409, body: { error: "person_has_account" } });
    expect(JSON.stringify(r.body)).not.toMatch(/Vera/);
  });

  it("conta verificada não troca a data de nascimento sozinha; nome vazio é recusado", async () => {
    const p = await orchestrator.loginPatient();
    expect((await app("POST", "/v1/auth/update-user", p.cookie, { name: "" })).status).toBe(400);
    await database.update(patient).set({ verifiedAt: new Date() }).where(eq(patient.id, p.patientId));
    const r = await app("POST", "/v1/auth/update-user", p.cookie, { birthDate: "1930-01-01" });
    expect(r).toMatchObject({ status: 409, body: { error: "birth_date_verified" } });
  });

  it("login da equipe só com letras, números, ponto ou _ (senão a pessoa nunca entraria)", async () => {
    const r = await c.request("POST", "/v1/panel/users", c.manager, {
      login: "maria silva",
      name: "Maria",
      ticket: "segredo123",
      ...unitManagerRoles(c.unitId),
    });
    expect(r.status).toBe(400);
  });
});

describe("sessões e estações", () => {
  it("sessão sem estação de atendimento é recusada (ninguém seria chamado)", async () => {
    const now = Date.now();
    const r = await session(now + 86400_000, now + 90000_000, []);
    expect(r).toMatchObject({ status: 400, body: { fields: { stations: [expect.any(String)] } } });
  });

  it("inscrição depois do fim da sessão → sessao_fechada", async () => {
    const now = Date.now();
    const s = await session(now - 5 * 3600_000, now - 3600_000);
    expect(s.status).toBe(201);
    const p = await orchestrator.loginPatient();
    const r = await app("POST", `${m()}/sessions/${s.body.id}/sign-ups`, p.cookie, {
      forWhom: { kind: "me" },
      answers: ROUTINE,
    });
    expect(r).toMatchObject({ status: 409, body: { error: "session_closed" } });
  });

  it("estação de sessão aberta não é arquivada nem tirada da sessão (ficaria impossível encerrar)", async () => {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    expect(await c.request("DELETE", `/v1/panel/stations/${c.e2}`, c.admin)).toMatchObject({
      status: 409,
      body: { error: "station_in_use" },
    });
    const current = await readSession(c.sessionId);
    const r = await c.request("PATCH", `/v1/panel/sessions/${c.sessionId}`, c.admin, {
      version: current?.version,
      stations: [c.e1],
    });
    expect(r).toMatchObject({ status: 409, body: { error: "forbidden_transition" } });
  });

  it("sessão aberta de outro dia continua na lista do painel até alguém encerrar", async () => {
    const now = Date.now();
    const ontem = await session(now - 30 * 3600_000, now - 26 * 3600_000);
    await c.request("POST", `/v1/panel/sessions/${ontem.body.id}/open`, c.admin);
    const today = await c.request("GET", `/v1/panel/units/${c.unitId}/today`, reception);
    expect(today.body.sessions.map((s: { id: string }) => s.id)).toContain(ontem.body.id);
  });

  it("RN-PUB-02: mais vagas promovem quem está na reserva", async () => {
    const now = Date.now();
    const s = await session(now + 2 * 86400_000, now + 2 * 86400_000 + 3600_000);
    await c.request("PATCH", `/v1/panel/sessions/${s.body.id}`, c.admin, { version: s.body.version, slots: 1 });
    await signUpPerson(c.slug, s.body.id, "Primeira");
    const reserve = await signUpPerson(c.slug, s.body.id, "Segunda");
    expect(reserve.state).toBe("in_reserve");
    const v = await readSession(s.body.id);
    const r = await c.request("PATCH", `/v1/panel/sessions/${s.body.id}`, c.admin, { version: v?.version, slots: 2 });
    expect(r.body.taken).toBe(2);
  });
});

describe("presença e TV", () => {
  it("'não confere' sem motivo → motivo_obrigatorio", async () => {
    const e = await signUpPerson(c.slug, c.sessionId, "Sem Documento");
    const r = await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: e.id,
      result: "does_not_match",
    });
    expect(r).toMatchObject({ status: 400, body: { error: "reason_required" } });
  });

  it("RN-PERF-03: tirar a prioridade ('prioridade não confere') também pede motivo", async () => {
    const e = await signUpPerson(c.slug, c.sessionId, "Sem Prova");
    const r = await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: e.id,
      result: "priority_does_not_match",
    });
    expect(r).toMatchObject({ status: 400, body: { error: "reason_required" } });
  });

  it("AD-024: a conferência da prioridade fica na entrada (vale nas próximas idas)", async () => {
    const withGroup = { ...ROUTINE, groups: ["pregnant" as const] };
    const kept = await signUpPerson(c.slug, c.sessionId, "Gestante Conferida", withGroup);
    const removed = await signUpPerson(c.slug, c.sessionId, "Gestante Sem Prova", withGroup);
    const mark = (entryId: string, result: string) =>
      c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
        entryId,
        result,
        reason: "conferido no balcão",
      });
    expect((await mark(kept.id, "matches")).status).toBe(200);
    expect((await mark(removed.id, "priority_does_not_match")).status).toBe(200);
    const priorityOf = async (id: string) =>
      (
        await orchestrator
          .municipalityDatabase(c.slug)
          .select({ p: entry.priority })
          .from(entry)
          .where(eq(entry.id, id))
      )[0]?.p;
    expect(await priorityOf(kept.id)).toMatchObject({ groups: ["pregnant"], verified: true });
    expect((await priorityOf(removed.id))?.groups).toEqual([]);
  });

  it("RN-PRES-03: a recepção vê o que conferir no documento (nascimento e CPF mascarado)", async () => {
    const queue = await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception);
    const item = queue.body.items.find((i: { name: string }) => i.name === "Sem Documento");
    expect(item.document).toEqual({ birthDate: "1990-05-05", cpf: expect.stringMatching(/^•••\.\d{3}\.\d{3}-••$/) });
  });

  it("código da TV vencido: o servidor decide (o relógio da TV não importa) e só uma TV é pareada", async () => {
    const reg = async () => {
      const r = await fetch(`${orchestrator.tenantOrigin(c.slug)}/v1/tv`, { method: "POST" });
      return (await r.json()) as { code: string; token: string };
    };
    const screen = async (token: string) =>
      (
        await fetch(`${orchestrator.tenantOrigin(c.slug)}/v1/tv/screen`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status;
    const old = await reg();
    await orchestrator
      .municipalityDatabase(c.slug)
      .update(tv)
      .set({ createdAt: new Date(Date.now() - 20 * 60_000) })
      .where(eq(tv.code, old.code));
    expect(await screen(old.token)).toBe(401);
    // Códigos pendentes não se repetem.
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) codes.add((await reg()).code);
    expect(codes.size).toBe(20);
  });

  it("o app tira o aparelho da conta ao sair (push)", async () => {
    const p = await orchestrator.loginPatient();
    await app("PUT", "/v1/patient/push", p.cookie, { token: "ExponentPushToken[sair]" });
    expect((await app("DELETE", "/v1/patient/push", p.cookie, { token: "ExponentPushToken[sair]" })).status).toBe(200);
  });
});

describe("abusos e configurações", () => {
  it("uma conta não lota uma sessão com pessoas inventadas: no máximo 5 inscrições ativas por sessão", async () => {
    const p = await orchestrator.loginPatient();
    const other = (i: number) =>
      app("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, p.cookie, {
        forWhom: {
          kind: "other",
          relationship: "legal_guardian",
          declared: true,
          name: `Pessoa ${i}`,
          birthDate: "2000-01-01",
          cpf: null,
        },
        answers: ROUTINE,
      });
    for (let i = 0; i < 5; i++) expect((await other(i)).status).toBe(201);
    expect(await other(6)).toMatchObject({ status: 409, body: { error: "limit_per_account" } });
  });

  it("não atribui ninguém a uma unidade removida", async () => {
    const id = await orchestrator.createDirectUnit(c.slug, "UBS Fechada");
    const u = { body: { id: typeof id === "string" ? id : (id as { id: string }).id } };
    expect((await c.request("DELETE", `/v1/panel/units/${u.body.id}`, c.manager)).status).toBeLessThan(300);
    const r = await c.request("POST", "/v1/panel/users", c.manager, {
      login: "na_fechada",
      name: "Na Fechada",
      ticket: "segredo123",
      ...unitManagerRoles(u.body.id),
    });
    expect(r.status).toBe(400);
  });

  it("quem é da equipe não troca o próprio login ou nome por fora da tela de equipe", async () => {
    const r = await c.request("POST", "/v1/panel/auth/update-user", reception, { username: "outro_login" });
    expect(r.status).toBe(404);
  });
});
