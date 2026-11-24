import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import { notice } from "infra/database/municipal/schema/notice";
import { sendAfterWrites } from "infra/notices/send-now";
import { type Sending, sweepMunicipality } from "infra/notices/sweep";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { municipalityWithUnit } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// AD-074: o push sai logo depois do pedido que gravou o aviso, sem esperar a varredura de 60 s. Um app
// mínimo com o hook de verdade, o banco do município e a outbox; "chamar grava o aviso" e a regra das
// chamadas (só enquanto a pessoa está chamada) estão em notices.test.
let slug: string;
let patientId: string;
let app: FastifyInstance;
const sent: Sending[] = [];
let failing = false;
const db = () => orchestrator.municipalityDatabase(slug);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  slug = (await municipalityWithUnit()).slug;
  const ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana" }));
  patientId = ana.patientId;
  await fetch(`${webserver.origin}/v1/patient/push`, {
    method: "PUT",
    headers: { cookie: ana.cookie, "content-type": "application/json" },
    body: JSON.stringify({ token: "ExponentPushToken[Ana]" }),
  });

  app = Fastify();
  app.decorateRequest("tenant", null);
  app.addHook("onRequest", async (req) => {
    req.tenant = { slug, municipalityId: null, timeZone: "America/Manaus", db: db() };
  });
  sendAfterWrites(
    app,
    async (list) => {
      if (failing) throw new Error("expo fora do ar");
      sent.push(...list);
      return list.map(() => ({ ok: true as const }));
    },
    // O banco é buscado pelo slug na hora do envio (o pool do pedido pode ter sido fechado).
    async (s) => (s === slug ? db() : null),
  );
  // Grava um aviso pendente, como a rota de chamar faz na transação da fila, e responde `status`.
  const writes = async (kind: string, status: number) => {
    await db()
      .insert(notice)
      .values({ key: randomUUID(), patientId, entryId: randomUUID(), kind, title: kind, body: "sala 1" });
    return status;
  };
  app.post<{ Params: { kind: string; status: string } }>("/write/:kind/:status", async (req, reply) =>
    reply.code(await writes(req.params.kind, Number(req.params.status))).send({}),
  );
  app.get<{ Params: { kind: string } }>("/read/:kind", async (req) => {
    await writes(req.params.kind, 200);
    return {};
  });
  await app.ready();
});
afterAll(async () => {
  await app?.close();
  await orchestrator.dropMunicipalities();
});

describe("envio na hora do evento (AD-074)", () => {
  it("escrita que deu certo: o aviso sai logo depois da resposta, sem a varredura", async () => {
    expect((await app.inject({ method: "POST", url: "/write/queue_opened/200" })).statusCode).toBe(200);
    await app.sendNow.idle(slug);
    expect(sent.map((x) => `${x.data.kind}:${x.for}`)).toEqual(["queue_opened:ExponentPushToken[Ana]"]);
    const [row] = await db().select().from(notice).where(eq(notice.kind, "queue_opened"));
    expect(row?.state).toBe("sent");
  });

  it("leitura não dispara; escrita, mesmo com erro na resposta, leva o que ficou, na ordem", async () => {
    await app.inject({ method: "GET", url: "/read/leave_home" });
    await app.sendNow.idle(slug);
    expect(sent.map((x) => x.data.kind)).toEqual(["queue_opened"]);
    await app.inject({ method: "POST", url: "/write/skipped/409" });
    await app.sendNow.idle(slug);
    expect(sent.map((x) => x.data.kind)).toEqual(["queue_opened", "leave_home", "skipped"]);

    await app.inject({ method: "POST", url: "/write/come_now/200" });
    await app.sendNow.idle(slug);
    expect(sent.map((x) => x.data.kind)).toEqual(["queue_opened", "leave_home", "skipped", "come_now"]);
    const states = await db().select().from(notice).orderBy(asc(notice.createdAt));
    expect(states.every((n) => n.state === "sent")).toBe(true);
  });

  it("erro na chamada à Expo: o aviso fica reservado (pode já ter chegado), sem reenvio no pedido seguinte", async () => {
    failing = true;
    await app.inject({ method: "POST", url: "/write/skipped/200" });
    await app.sendNow.idle(slug);
    failing = false;
    const [row] = await db().select().from(notice).where(eq(notice.kind, "skipped")).orderBy(desc(notice.seq)).limit(1);
    expect(row?.state).toBe("pending");
    expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
    const before = sent.length;
    await app.inject({ method: "POST", url: "/write/leave_home/200" });
    await app.sendNow.idle(slug);
    expect(sent.slice(before).map((x) => x.data.kind)).toEqual(["leave_home"]);
  });

  it("avisos gravados na mesma transação ficam na ordem em que foram gravados", async () => {
    const entryId = randomUUID();
    await db().transaction(async (tx) => {
      for (const kind of ["your_turn", "skipped", "recalled"])
        await tx.insert(notice).values({ key: randomUUID(), patientId, entryId, kind, title: kind, body: "b" });
    });
    const rows = await db().select().from(notice).where(eq(notice.entryId, entryId)).orderBy(asc(notice.seq));
    expect(rows.map((r) => r.kind)).toEqual(["your_turn", "skipped", "recalled"]);
    expect(new Set(rows.map((r) => r.seq)).size).toBe(3);
  });

  it("mais avisos que um lote (100): a mesma rodada envia todos, sem esperar a varredura", async () => {
    const batch = `lote-${randomUUID()}`;
    await db()
      .insert(notice)
      .values(
        Array.from({ length: 150 }, (_, i) => ({
          key: `${batch}:${i}`,
          patientId,
          entryId: randomUUID(),
          kind: "queue_opened",
          title: batch,
          body: "b",
        })),
      );
    await app.inject({ method: "POST", url: "/write/queue_opened/200" });
    await app.sendNow.idle(slug);
    expect(sent.filter((x) => x.title === batch)).toHaveLength(150);
  });

  it("a varredura também esvazia mais de um lote (100) na mesma rodada", async () => {
    const batch = `varredura-${randomUUID()}`;
    await db()
      .insert(notice)
      .values(
        Array.from({ length: 150 }, (_, i) => ({
          key: `${batch}:${i}`,
          patientId,
          entryId: randomUUID(),
          kind: "queue_opened",
          title: batch,
          body: "b",
        })),
      );
    const swept: Sending[] = [];
    await sweepMunicipality(db(), Date.now(), async (list) => {
      swept.push(...list);
      return list.map(() => ({ ok: true as const }));
    });
    expect(swept.filter((x) => x.title === batch)).toHaveLength(150);
  });
});
