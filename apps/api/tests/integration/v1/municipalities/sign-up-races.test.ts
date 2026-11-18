import { personFromRequest, signUpPatient } from "infra/queue/app";
import orchestrator from "tests/orchestrator";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// L-003: pedidos simultâneos da inscrição pública (duplo toque, dois aparelhos, script).
let c: Awaited<ReturnType<typeof queueScenario>>;
let second: string;

const other = (name: string, cpf: string | null = null) => ({
  forWhom: {
    kind: "other" as const,
    relationship: "legal_guardian" as const,
    declared: true as const,
    name,
    birthDate: "2015-01-01",
    cpf,
  },
  answers: ROUTINE,
});
const account = (id: string) => ({ patientId: id, cpf: orchestrator.generateCpf(), verified: false });

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  const start = Date.now() + 2 * 86400_000;
  second = (
    await c.request("POST", `/v1/panel/units/${c.unitId}/sessions`, c.admin, {
      serviceId: c.serviceId,
      start: new Date(start).toISOString(),
      end: new Date(start + 4 * 3600_000).toISOString(),
      slots: 20,
      visibility: "public",
      waivesPreRegistration: false,
      professional: null,
      stations: [c.e1],
    })
  ).body.id as string;
});
afterAll(() => orchestrator.dropMunicipalities());

describe("inscrição pública com pedidos simultâneos", () => {
  it("RN-ID-07: o limite de pessoas por conta vale mesmo com pedidos ao mesmo tempo", async () => {
    const db = orchestrator.municipalityDatabase(c.slug);
    const p = account("conta-limite");
    for (let i = 0; i < 4; i++) await signUpPatient(db, p, c.sessionId, other(`Pessoa ${i}`), Date.now());
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => signUpPatient(db, p, c.sessionId, other(`Paralela ${i}`), Date.now())),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("INV-01: a mesma pessoa em duas sessões do mesmo serviço ao mesmo tempo entra numa só", async () => {
    const db = orchestrator.municipalityDatabase(c.slug);
    const cpf = orchestrator.generateCpf();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        signUpPatient(db, account(`conta-${i}`), i % 2 ? c.sessionId : second, other("Duda Dupla", cpf), Date.now()),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    // Nenhuma falha vira erro interno (500): todas são recusas tratadas.
    for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ status: 409 });
  });
});

describe("RN-ID-07: consultas de CPF por conta", () => {
  it("uma conta informa no máximo 20 CPFs de outras pessoas por hora; depois, 429", async () => {
    const p = account("conta-oraculo");
    for (let i = 0; i < 20; i++) {
      await personFromRequest(p, other(`Pessoa ${i}`, orchestrator.generateCpf()).forWhom);
    }
    await expect(personFromRequest(p, other("Mais uma", orchestrator.generateCpf()).forWhom)).rejects.toMatchObject({
      status: 429,
      code: "cpf_lookup_limit",
    });
    // Sem CPF não consulta a base de contas: não conta.
    await expect(personFromRequest(p, other("Sem CPF").forWhom)).resolves.toMatchObject({ cpf: null });
    // Outra conta não é afetada.
    await expect(
      personFromRequest(account("outra-conta"), other("Livre", orchestrator.generateCpf()).forWhom),
    ).resolves.toBeDefined();
  });
});
