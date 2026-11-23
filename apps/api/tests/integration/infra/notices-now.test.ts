import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import { notice } from "infra/database/municipal/schema/notice";
import { sendAfterWrites } from "infra/notices/send-now";
import type { Sending } from "infra/notices/sweep";
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

  it("leitura ou escrita com erro não disparam; a próxima escrita leva o que ficou, na ordem", async () => {
    await app.inject({ method: "GET", url: "/read/leave_home" });
    await app.inject({ method: "POST", url: "/write/skipped/409" });
    await app.sendNow.idle(slug);
    expect(sent.map((x) => x.data.kind)).toEqual(["queue_opened"]);

    await app.inject({ method: "POST", url: "/write/come_now/200" });
    await app.sendNow.idle(slug);
    expect(sent.map((x) => x.data.kind)).toEqual(["queue_opened", "leave_home", "skipped", "come_now"]);
    const states = await db().select().from(notice).orderBy(asc(notice.createdAt));
    expect(states.every((n) => n.state === "sent")).toBe(true);
  });

  it("erro depois da reserva devolve o aviso na hora, sem esperar a reserva de 5 min vencer", async () => {
    failing = true;
    await app.inject({ method: "POST", url: "/write/skipped/200" });
    await app.sendNow.idle(slug);
    failing = false;
    const [row] = await db().select().from(notice).where(eq(notice.state, "pending"));
    expect(row?.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
    await app.inject({ method: "POST", url: "/write/leave_home/200" });
    await app.sendNow.idle(slug);
    expect(sent.map((x) => x.data.kind).slice(-2)).toEqual(["skipped", "leave_home"]);
  });
});
