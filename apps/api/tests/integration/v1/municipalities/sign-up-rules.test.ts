import { eq } from "drizzle-orm";
import { localPerson } from "infra/database/municipal/schema/local-person";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { CAPTCHA_OK, queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Revisão de 2026-11-14: o app não pode deixar tentar o que a regra proíbe, e a API recusa cedo e claro.

let c: Awaited<ReturnType<typeof queueScenario>>;

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
const m = () => `/v1/municipalities/${c.slug}`;
const other = (name: string, birthDate: string, cpf: string | null) => ({
  kind: "other",
  relationship: "legal_guardian",
  declared: true,
  name,
  birthDate: birthDate,
  cpf,
});
const signUp = (cookie: string, forWhom: unknown) =>
  app("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, cookie, { forWhom, answers: ROUTINE });
const check = (cookie: string, forWhom: unknown) =>
  app("POST", `${m()}/sessions/${c.sessionId}/sign-ups/check`, cookie, { forWhom });
const mine = async (cookie: string) => (await app("GET", `${m()}/mine`, cookie)).body;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
});
afterAll(() => orchestrator.dropMunicipalities());

describe("CPF em 'outra pessoa'", () => {
  it("o próprio CPF da conta como 'outra pessoa' → cpf_da_conta (use 'para mim')", async () => {
    const ana = await orchestrator.loginPatient();
    const r = await signUp(ana.cookie, other("Ana Qualquer", "1990-01-01", ana.data.cpf));
    expect(r).toMatchObject({ status: 409, body: { error: "own_account_cpf" } });
  });

  it("CPF de quem tem conta no app → pessoa_tem_conta (ela se inscreve pela conta dela)", async () => {
    const owner = await orchestrator.loginPatient();
    const otherAccount = await orchestrator.loginPatient();
    const r = await signUp(otherAccount.cookie, other(owner.data.name, owner.data.birthDate, owner.data.cpf));
    expect(r).toMatchObject({ status: 409, body: { error: "person_has_account" } });
  });

  it("dados errados digitados por terceiros não trancam o dono do CPF quando ele cria a conta", async () => {
    const cpf = orchestrator.generateCpf();
    const tia = await orchestrator.loginPatient();
    expect((await signUp(tia.cookie, other("Nome Errado", "1950-05-05", cpf))).status).toBe(201);
    await app("POST", `${m()}/entries/${(await mine(tia.cookie))[0].entryId}/cancel`, tia.cookie);
    const owner = await orchestrator.loginPatient(orchestrator.registrationData({ cpf, name: "Dono Certo" }));
    expect((await signUp(owner.cookie, { kind: "me" })).status).toBe(201);
    const [p] = await orchestrator
      .municipalityDatabase(c.slug)
      .select()
      .from(localPerson)
      .where(eq(localPerson.cpf, cpf));
    expect(p).toMatchObject({ name: "Dono Certo", birthDate: owner.data.birthDate, patientId: owner.patientId });
  });
});

describe("verificação antes do questionário", () => {
  it("diz já na escolha de 'para quem' que a pessoa já está inscrita, sem criar nada", async () => {
    const bruno = await orchestrator.loginPatient();
    expect(await check(bruno.cookie, { kind: "me" })).toMatchObject({ status: 200, body: { ok: true } });
    expect(await mine(bruno.cookie)).toEqual([]);
    await signUp(bruno.cookie, { kind: "me" });
    expect(await check(bruno.cookie, { kind: "me" })).toMatchObject({ status: 409, body: { error: "duplicate" } });
  });

  it("a mesma 'outra pessoa' sem CPF (mesmo nome e nascimento) não entra duas vezes", async () => {
    const mother = await orchestrator.loginPatient();
    expect((await signUp(mother.cookie, other("Lia Souza", "2019-03-03", null))).status).toBe(201);
    expect(await check(mother.cookie, other("lia  souza", "2019-03-03", null))).toMatchObject({
      status: 409,
      body: { error: "duplicate" },
    });
    // Outro filho com o mesmo nome e outra data de nascimento é outra pessoa.
    expect((await check(mother.cookie, other("Lia Souza", "2021-07-07", null))).status).toBe(200);
  });
});

describe("o que 'minhas' diz para o app decidir", () => {
  it("podeCancelar e o nascimento de cada pessoa", async () => {
    const p = await orchestrator.loginPatient();
    await signUp(p.cookie, { kind: "me" });
    const [e] = await mine(p.cookie);
    expect(e).toMatchObject({ canCancel: true, birthDate: p.data.birthDate });
  });
});
