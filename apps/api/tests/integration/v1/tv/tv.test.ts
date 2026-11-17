import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;
let tv: { code: string; token: string };
let tvId: string;
const entries: Record<string, string> = {};

// A TV fala com a API pelo Host do município e o token do navegador (PD-47), sem cookie.
async function fromTv(method: string, path: string, token?: string) {
  const r = await fetch(`${orchestrator.tenantOrigin(c.slug)}${path}`, {
    method: method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
const screen = (token = tv.token) => fromTv("GET", "/v1/tv/screen", token);
const pair = (code: string, cookie = c.admin) => c.request("POST", `/v1/panel/units/${c.unitId}/tvs`, cookie, { code });

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  for (const name of ["Ana", "Bruno", "Carla"]) entries[name] = (await signUpPerson(c.slug, c.sessionId, name)).id;
});
afterAll(() => orchestrator.dropMunicipalities());

describe("pareamento da TV (RN-TV-01, RN-TV-02)", () => {
  it("a TV se registra e mostra o código de 6 dígitos; sem token, nada", async () => {
    const r = await fromTv("POST", "/v1/tv");
    expect(r.status).toBe(201);
    expect(r.body.code).toMatch(/^\d{6}$/);
    tv = r.body;
    expect((await screen()).body).toMatchObject({ state: "waiting", code: tv.code });
    expect((await screen("inventado")).status).toBe(401);
  });

  it("só quem configura a unidade pareia; código errado → codigo_invalido", async () => {
    expect((await pair(tv.code, reception)).status).toBe(403);
    expect((await pair(tv.code === "000000" ? "111111" : "000000")).body.error).toBe("invalid_code");
    const r = await pair(tv.code);
    expect(r.status).toBe(201);
    tvId = r.body.id;
    expect((await pair(tv.code)).body.error).toBe("invalid_code");
  });

  it("pareada: mostra a unidade; o painel lista a TV online", async () => {
    expect((await screen()).body).toMatchObject({
      state: "paired",
      unit: { id: c.unitId },
      calls: [],
      qr: null,
      // A TV anuncia e mostra a hora pelo relógio do servidor, no fuso da unidade (o da TV pode estar errado).
      timeZone: "America/Sao_Paulo",
    });
    expect(Math.abs(Date.parse((await screen()).body.now) - Date.now())).toBeLessThan(60_000);
    const list = await c.request("GET", `/v1/panel/units/${c.unitId}/tvs`, c.admin);
    expect(list.body).toEqual([expect.objectContaining({ id: tvId, online: true })]);
  });
});

describe("tela da TV (RN-TV-03, RN-TV-05, RN-TV-07)", () => {
  it("contadores por serviço, chamadas com senha e destino e nunca nomes; QR com a sessão aberta", async () => {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    for (const n of ["Ana", "Bruno"]) {
      await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
        entryId: entries[n],
        result: "matches",
      });
    }
    expect((await screen()).body.services).toEqual([{ name: "Clínico", waiting: 2, onTheWay: 1 }]);
    await c.request("POST", `/v1/panel/stations/${c.e1}/call`, c.nurse, {});
    await c.request("POST", `/v1/panel/stations/${c.e2}/call`, c.nurse, {});
    const r = (await screen()).body;
    expect(r.calls.map((x: { ticket: string; destination: string }) => [x.ticket, x.destination])).toEqual([
      ["C-002", "Sala 2"],
      ["C-001", "Sala 1"],
    ]);
    expect(r.highlightSeconds).toBe(10);
    expect(r.qr.content).toMatch(/^filasaude:\/\/check-in\?/);
    expect(JSON.stringify(r)).not.toMatch(/Ana|Bruno|Carla/);
  });

  it("RN-CHAM-02: rechamar repete o anúncio na TV", async () => {
    await c.request("POST", `/v1/panel/stations/${c.e1}/recall`, c.nurse, {});
    const r = (await screen()).body;
    expect(r.calls[0]).toMatchObject({ ticket: "C-001", destination: "Sala 1" });
    expect(new Set(r.calls.map((x: { id: string }) => x.id)).size).toBe(r.calls.length);
  });

  it("revogada: a TV perde o acesso e volta a se registrar", async () => {
    expect((await c.request("DELETE", `/v1/panel/tvs/${tvId}`, reception)).status).toBe(403);
    expect((await c.request("DELETE", `/v1/panel/tvs/${tvId}`, c.admin)).status).toBe(200);
    expect(await screen()).toMatchObject({ status: 401, body: { error: "tv_not_paired" } });
  });
});
