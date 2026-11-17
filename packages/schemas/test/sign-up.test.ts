import { describe, expect, it } from "vitest";
import { birthDateSchema } from "../auth.ts";
import { queueItemSchema, signUpInputSchema } from "../queue.ts";

const answers = { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] };
const other = (data: Record<string, unknown>) =>
  signUpInputSchema.safeParse({
    forWhom: {
      kind: "other",
      name: "Bia Reis",
      birthDate: "2018-03-03",
      cpf: null,
      relationship: "legal_guardian",
      declared: true,
      ...data,
    },
    answers,
  });

describe("inscrição para outra pessoa (AD-018), revisão 2026-11-13", () => {
  it("CPF opcional, mas quando vem precisa ser válido; sai só com dígitos", () => {
    expect(other({}).success).toBe(true);
    expect(other({ cpf: "123.456.789-00" }).success).toBe(false);
    expect(other({ cpf: "111.111.111-11" }).success).toBe(false);
    const r = other({ cpf: "390.533.447-05" });
    expect(r.success && r.data.forWhom.kind === "other" && r.data.forWhom.cpf).toBe("39053344705");
  });

  it("nascimento real, não no futuro e não mais de 130 anos atrás", () => {
    expect(other({ birthDate: "2020-02-31" }).success).toBe(false);
    expect(other({ birthDate: "2999-01-01" }).success).toBe(false);
    expect(birthDateSchema.safeParse("1850-01-01").success).toBe(false);
    expect(birthDateSchema.safeParse("1950-06-15").success).toBe(true);
  });
});

describe("a relação de quem inscreve outra pessoa (2026-11-16)", () => {
  it("outra pessoa exige a relação e a declaração", () => {
    expect(other({ relationship: undefined }).success).toBe(false);
    expect(other({ relationship: "vizinho" }).success).toBe(false);
    expect(other({ declared: false }).success).toBe(false);
    expect(other({ declared: undefined }).success).toBe(false);
    for (const relationship of ["legal_guardian", "caregiver", "family_or_friend"])
      expect(other({ relationship }).success).toBe(true);
  });

  it("para mim não pede relação", () => {
    expect(signUpInputSchema.safeParse({ forWhom: { kind: "me" }, answers }).success).toBe(true);
  });

  it("a Fila do dia diz quem inscreveu e a relação, ou nada quando foi a própria pessoa", () => {
    const item = {
      id: "i1",
      entryId: "8f5b7c1e-2d3a-4b5c-9d6e-7f8a9b0c1d2e",
      ticket: "A1",
      name: "Bia Reis",
      stage: "care",
      state: "remote",
      skips: 0,
      risk: "routine",
      priority: false,
      stationId: null,
      pendingChecks: [],
      document: { birthDate: "2018-03-03", cpf: null },
    };
    expect(queueItemSchema.safeParse({ ...item, guardian: null }).success).toBe(true);
    expect(queueItemSchema.safeParse({ ...item, guardian: { name: "Bruno", relationship: "caregiver" } }).success).toBe(
      true,
    );
    expect(queueItemSchema.safeParse(item).success).toBe(false);
    // Inscrita por outra conta antes de existir a relação: mostra quem inscreveu, sem a relação.
    expect(queueItemSchema.safeParse({ ...item, guardian: { name: "Bruno", relationship: null } }).success).toBe(true);
  });
});
