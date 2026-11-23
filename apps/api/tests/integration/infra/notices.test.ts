import { asc, eq, sql } from "drizzle-orm";
import { notice } from "infra/database/municipal/schema/notice";
import { type Sending, sweepMunicipality } from "infra/notices/sweep";
import { readDay } from "infra/queue/day";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { CAPTCHA_OK, queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;
const accounts: Record<string, Awaited<ReturnType<typeof orchestrator.loginPatient>>> = {};
const entries: Record<string, string> = {};

async function app(method: string, path: string, cookie?: string, body?: unknown) {
  const r = await fetch(`${webserver.origin}${path}`, {
    method: method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...CAPTCHA_OK,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}

// Enviador de mentira: guarda o que mandaria e responde ok (ou erro, para testar a nova tentativa).
function sender(fail = false) {
  const sent: Sending[] = [];
  return {
    sent,
    send: async (list: Sending[]) => {
      sent.push(...list);
      return list.map(() => (fail ? { ok: false as const, error: "fora do ar" } : { ok: true as const }));
    },
  };
}

const db = () => orchestrator.municipalityDatabase(c.slug);
const notices = () => db().select().from(notice).orderBy(asc(notice.createdAt));
const patientOf = async (name: string) =>
  (await notices()).filter((a) => a.patientId === accounts[name]?.patientId).map((a) => a.kind);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  for (const name of ["Ana", "Bruno", "Carla", "Davi"]) {
    accounts[name] = await orchestrator.loginPatient(orchestrator.registrationData({ name }));
    const r = await app(
      "POST",
      `/v1/municipalities/${c.slug}/sessions/${c.sessionId}/sign-ups`,
      accounts[name]?.cookie,
      {
        forWhom: { kind: "me" },
        answers: ROUTINE,
      },
    );
    entries[name] = r.body.entryId;
  }
});
afterAll(() => orchestrator.dropMunicipalities());

describe("avisos por push (T3.8, T2.4)", () => {
  it("o app registra o token de push da conta; sem conta → 401", async () => {
    expect((await app("PUT", "/v1/patient/push", undefined, { token: "ExponentPushToken[x]" })).status).toBe(401);
    for (const name of ["Ana", "Carla"]) {
      const r = await app("PUT", "/v1/patient/push", accounts[name]?.cookie, { token: `ExponentPushToken[${name}]` });
      expect(r.status).toBe(200);
    }
  });

  it("abrir a sessão avisa cada inscrito com conta que ele está na fila remota (tv-e-avisos)", async () => {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    for (const n of ["Ana", "Bruno", "Carla", "Davi"]) expect(await patientOf(n)).toEqual(["queue_opened"]);
    const [opened] = (await notices()).filter((a) => a.patientId === accounts.Ana?.patientId);
    expect(opened?.title).toMatch(/^a fila de hoje abriu/);
    expect(opened?.body).toMatch(/senha C-00\d/);
  });

  it("chamar grava 'sua vez' na mesma transação, com senha e sala e sem dado clínico (RN-NOT-01)", async () => {
    for (const n of ["Ana", "Bruno"]) {
      await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
        entryId: entries[n],
        result: "matches",
      });
    }
    await c.request("POST", `/v1/panel/stations/${c.e1}/call`, c.nurse, {});
    const [a] = (await notices()).filter((x) => x.kind === "your_turn");
    expect(a).toMatchObject({ kind: "your_turn", patientId: accounts.Ana?.patientId, state: "pending" });
    expect(a?.title).toMatch(/sua vez/);
    expect(`${a?.title} ${a?.body}`).toMatch(/C-001/);
    expect(a?.body).toMatch(/sala 1/);
  });

  it("rechamar avisa de novo, um aviso por rechamada", async () => {
    await c.request("POST", `/v1/panel/stations/${c.e1}/recall`, c.nurse, {});
    await c.request("POST", `/v1/panel/stations/${c.e1}/recall`, c.nurse, {});
    const recalls = (await notices()).filter((x) => x.kind === "recalled");
    expect(recalls).toHaveLength(2);
    expect(recalls[0]).toMatchObject({ patientId: accounts.Ana?.patientId, state: "pending" });
    expect(recalls[0]?.title).toMatch(/chamando você de novo/);
    expect(`${recalls[0]?.title} ${recalls[0]?.body}`).toMatch(/C-001/);
    expect(recalls[0]?.body).toMatch(/sala 1/);
  });

  it("a varredura gera 'venha agora' e 'saia de casa' uma vez só e envia; sem token fica no_device", async () => {
    await c.request("POST", `/v1/panel/stations/${c.e2}/call`, c.nurse, {});
    const e = sender();
    await sweepMunicipality(db(), Date.now(), e.send);
    expect(await patientOf("Carla")).toEqual(["queue_opened", "come_now"]);
    expect(await patientOf("Davi")).toEqual(["queue_opened", "leave_home"]);
    // A tela do app concorda com o push: "hora de sair de casa".
    const mine = await app("GET", `/v1/municipalities/${c.slug}/mine`, accounts.Davi?.cookie);
    expect(mine.body[0]).toMatchObject({ leaveHome: true });
    expect(e.sent.map((x) => `${x.data.kind}:${x.for}`).sort()).toEqual([
      "come_now:ExponentPushToken[Carla]",
      "queue_opened:ExponentPushToken[Ana]",
      "queue_opened:ExponentPushToken[Carla]",
      "recalled:ExponentPushToken[Ana]",
    ]);
    // AD-074: aqui nada saiu na hora (os testes não ligam o envio na hora), então "sua vez" e as duas
    // rechamadas chegam atrasadas juntas: vai só a última, as outras ficam como `stale`.
    const calls = (await notices()).filter((a) => a.patientId === accounts.Ana?.patientId && a.kind !== "queue_opened");
    expect(calls.map((a) => `${a.kind}:${a.state}`)).toEqual(["your_turn:stale", "recalled:stale", "recalled:sent"]);
    const byKind = Object.fromEntries((await notices()).map((a) => [`${a.kind}:${a.patientId}`, a.state]));
    expect(byKind[`your_turn:${accounts.Bruno?.patientId}`]).toBe("no_device");
    expect(byKind[`your_turn:${accounts.Ana?.patientId}`]).toBe("stale");

    const other = sender();
    await sweepMunicipality(db(), Date.now(), other.send);
    expect(other.sent).toEqual([]);
    expect((await notices()).length).toBe(10); // 4 da abertura + sua vez (2), 2 rechamadas, venha agora, saia de casa
  });

  it("AD-057: a varredura grava a hora do 'venha agora' no dia; o prazo de chegada conta dela", async () => {
    const day = await readDay(db(), c.sessionId);
    const carla = day?.items.find((i) => i.entryId === entries.Carla);
    expect(day?.comeNow).toEqual([{ itemId: carla?.id, stage: "care", at: expect.any(Number) }]);
  });

  it("'você foi pulado' com nova tentativa quando o envio falha", async () => {
    await c.request("POST", `/v1/panel/stations/${c.e1}/no-show`, c.nurse, {});
    expect(await patientOf("Ana")).toEqual(["queue_opened", "your_turn", "recalled", "recalled", "skipped"]);
    const now = Date.now();
    await sweepMunicipality(db(), now, sender(true).send);
    const [skip] = (await notices()).filter((a) => a.kind === "skipped");
    expect(skip).toMatchObject({ state: "pending", attempts: 1 });
    expect(skip?.nextAttemptAt.getTime()).toBeGreaterThan(now);

    const early = sender();
    await sweepMunicipality(db(), now + 1000, early.send);
    expect(early.sent).toEqual([]);
    const after = sender();
    await sweepMunicipality(db(), now + 10 * 60_000, after.send);
    expect(after.sent.map((x) => x.for)).toEqual(["ExponentPushToken[Ana]"]);
    const [sent] = await db()
      .select()
      .from(notice)
      .where(eq(notice.id, skip?.id as string));
    expect(sent?.state).toBe("sent");
  });
  it("o envio acontece fora da transação: durante o envio o aviso não fica travado, e sai uma vez só", async () => {
    const [mine] = await db()
      .insert(notice)
      .values({
        key: `teste:${Date.now()}`,
        patientId: accounts.Ana?.patientId as string,
        kind: "test",
        title: "t",
        body: "b",
      })
      .returning({ id: notice.id });
    let lockedDuringSend: boolean | null = null;
    const sent: Sending[] = [];
    await sweepMunicipality(db(), Date.now(), async (list) => {
      sent.push(...list);
      lockedDuringSend = await db()
        .transaction(async (tx) => {
          await tx.execute(sql`select id from notice where id = ${mine?.id} for update nowait`);
          return false;
        })
        .catch(() => true);
      return list.map(() => ({ ok: true as const }));
    });
    expect(lockedDuringSend).toBe(false);
    expect(sent.filter((x) => x.title === "t")).toHaveLength(1);
    const [row] = await db()
      .select()
      .from(notice)
      .where(eq(notice.id, mine?.id as string));
    expect(row).toMatchObject({ state: "sent", attempts: 1 });
  });
});
