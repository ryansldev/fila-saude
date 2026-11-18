import { errorSchema } from "@fila-saude/schemas/errors";
import { sql } from "drizzle-orm";
import database from "infra/database";
import webserver from "infra/webserver";
import orchestrator, { type RegistrationData } from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

const CPF_IN_USE_MESSAGE = "Procure a recepção da sua unidade para contestar.";

type PatientRow = {
  id: string;
  cpf: string;
  username: string;
  email: string;
  name: string;
  birthDate: string;
  phone: string;
  verified_at: Date | null;
  verification_method: string | null;
  verified_municipality: string | null;
};

async function patientsWithCpf(cpf: string) {
  const result = await database.execute<PatientRow>(sql`
    select id, cpf, username, email, name, birth_date::text as "birthDate", phone,
      verified_at, verification_method, verified_municipality
    from patient where cpf = ${cpf}
  `);
  return result.rows;
}

function mask(cpf: string) {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

// Troca o último dígito verificador: o CPF continua com 11 dígitos, mas fica inválido.
function cpfWithWrongChecker(cpf: string) {
  const last = Number(cpf.at(-1));
  return `${cpf.slice(0, 10)}${(last + 1) % 10}`;
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("POST /v1/auth/sign-up/email (cadastro do paciente)", () => {
  it("RN-ID-01: cadastro com CPF válido cria conta", async () => {
    const data = orchestrator.registrationData({ cpf: mask(orchestrator.generateCpf()) });
    const cpf = data.cpf.replace(/\D/g, "");

    const answer = await orchestrator.registerPatient(data);

    expect(answer.status).toBe(200);
    expect(orchestrator.cookiesOf(answer)).toContain("better-auth.session_token=");
    const body = (await answer.json()) as { user: Record<string, unknown> };
    expect(body.user).toMatchObject({ email: data.email, name: data.name, cpf, username: cpf });

    const rows = await patientsWithCpf(cpf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cpf,
      username: cpf,
      email: data.email,
      name: data.name,
      birthDate: data.birthDate,
      phone: "11987654321",
    });
  });

  it("RN-ID-01: CPF inválido → 400 cpf_invalido", async () => {
    const answer = await orchestrator.registerPatient(
      orchestrator.registrationData({ cpf: cpfWithWrongChecker(orchestrator.generateCpf()) }),
    );

    expect(answer.status).toBe(400);
    expect(await answer.json()).toEqual({ error: "invalid_cpf" });
  });

  it("RN-ID-01: CPF com 10 e 12 dígitos → 400 cpf_invalido; com 11 válidos, cria", async () => {
    const cpf = orchestrator.generateCpf();

    const short = await orchestrator.registerPatient(orchestrator.registrationData({ cpf: cpf.slice(0, 10) }));
    expect(short.status).toBe(400);
    expect(await short.json()).toEqual({ error: "invalid_cpf" });

    const long = await orchestrator.registerPatient(orchestrator.registrationData({ cpf: `${cpf}0` }));
    expect(long.status).toBe(400);
    expect(await long.json()).toEqual({ error: "invalid_cpf" });

    const right = await orchestrator.registerPatient(orchestrator.registrationData({ cpf }));
    expect(right.status).toBe(200);
  });

  it("RN-ID-02: CPF já usado → 409 cpf_em_uso com orientação da recepção", async () => {
    const cpf = orchestrator.generateCpf();
    const first = await orchestrator.registerPatient(orchestrator.registrationData({ cpf }));
    expect(first.status).toBe(200);

    for (const sameCpf of [cpf, mask(cpf)]) {
      const answer = await orchestrator.registerPatient(orchestrator.registrationData({ cpf: sameCpf }));
      expect(answer.status).toBe(409);
      expect(await answer.json()).toEqual({ error: "cpf_in_use", message: CPF_IN_USE_MESSAGE });
    }

    expect(await patientsWithCpf(cpf)).toHaveLength(1);
  });

  it("RN-ID-02: dois cadastros simultâneos do mesmo CPF → exatamente um cria e o outro recebe 409", async () => {
    const cpf = orchestrator.generateCpf();

    const answers = await Promise.all([
      orchestrator.registerPatient(orchestrator.registrationData({ cpf })),
      orchestrator.registerPatient(orchestrator.registrationData({ cpf: mask(cpf) })),
    ]);

    const status = answers.map((answer) => answer.status).sort();
    expect(status).toEqual([200, 409]);
    const refused = answers.find((answer) => answer.status === 409);
    expect(await refused?.json()).toEqual({ error: "cpf_in_use", message: CPF_IN_USE_MESSAGE });
    expect(await patientsWithCpf(cpf)).toHaveLength(1);
  });

  it("RN-ID-01: e-mail é obrigatório", async () => {
    const { email: _email, ...withoutEmail } = orchestrator.registrationData();

    const answer = await orchestrator.registerPatient(withoutEmail);

    expect(answer.status).toBe(400);
    const body = errorSchema.parse(await answer.json());
    expect(body.error).toBe("invalid_input");
    expect(Object.keys(body.fields ?? {})).toEqual(["email"]);
    expect(await patientsWithCpf(withoutEmail.cpf)).toHaveLength(0);
  });

  it("RN-ID-04: senha com 7 caracteres é recusada; com 8, aceita", async () => {
    const short = await orchestrator.registerPatient(orchestrator.registrationData({ password: "1234567" }));
    expect(short.status).toBe(400);
    const body = errorSchema.parse(await short.json());
    expect(body.error).toBe("invalid_input");
    expect(Object.keys(body.fields ?? {})).toEqual(["password"]);

    const minimum = await orchestrator.registerPatient(orchestrator.registrationData({ password: "12345678" }));
    expect(minimum.status).toBe(200);
  });

  it("PD-23: telefone e nascimento são validados", async () => {
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const cases: Array<[Partial<RegistrationData>, string]> = [
      [{ phone: "123456789" }, "phone"],
      [{ phone: "(11) 9876-543210" }, "phone"],
      [{ birthDate: "17/05/1990" }, "birthDate"],
      [{ birthDate: tomorrow }, "birthDate"],
    ];

    for (const [field, key] of cases) {
      const answer = await orchestrator.registerPatient(orchestrator.registrationData(field));
      expect(answer.status).toBe(400);
      const body = errorSchema.parse(await answer.json());
      expect(body.error).toBe("invalid_input");
      expect(Object.keys(body.fields ?? {})).toEqual([key]);
    }
  });

  it("RN-ID-05: conta nasce não verificada", async () => {
    const data = orchestrator.registrationData();

    const answer = await orchestrator.registerPatient(data);

    expect(answer.status).toBe(200);
    const [row] = await patientsWithCpf(data.cpf);
    expect(row?.verified_at).toBeNull();
    expect(row?.verification_method).toBeNull();
    expect(row?.verified_municipality).toBeNull();
  });

  it("RN-ID-05: cliente não consegue mandar verificadoEm", async () => {
    const data = orchestrator.registrationData();

    const answer = await orchestrator.registerPatient({
      ...data,
      verifiedAt: new Date().toISOString(),
      verificationMethod: "presencial",
      verifiedMunicipality: "00000000-0000-4000-8000-000000000000",
      verified_at: new Date().toISOString(),
    });

    expect(answer.status).toBe(200);
    const [row] = await patientsWithCpf(data.cpf);
    expect(row?.verified_at).toBeNull();
    expect(row?.verification_method).toBeNull();
    expect(row?.verified_municipality).toBeNull();
  });

  it("RN-ID-02: o paciente não troca o CPF da conta depois do cadastro", async () => {
    const data = orchestrator.registrationData();
    const registration = await orchestrator.registerPatient(data);
    expect(registration.status).toBe(200);
    const otherCpf = orchestrator.generateCpf();

    for (const body of [{ username: otherCpf }, { displayUsername: otherCpf }, { cpf: otherCpf }]) {
      const answer = await fetch(`${webserver.origin}/v1/auth/update-user`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: webserver.origin,
          cookie: orchestrator.cookiesOf(registration),
        },
        body: JSON.stringify(body),
      });
      expect(answer.status).toBe(400);
      expect(errorSchema.parse(await answer.json()).error).toBe("invalid_input");
    }

    const [row] = await patientsWithCpf(data.cpf);
    expect(row?.username).toBe(data.cpf);
    expect(await patientsWithCpf(otherCpf)).toHaveLength(0);
  });

  it("RN-ID-05: o paciente não marca a própria conta como verificada pelo update-user", async () => {
    const data = orchestrator.registrationData();
    const registration = await orchestrator.registerPatient(data);
    expect(registration.status).toBe(200);
    const cases: Array<[string, unknown]> = [
      ["verifiedAt", new Date().toISOString()],
      ["verificationMethod", "presencial"],
      ["verifiedMunicipality", "00000000-0000-4000-8000-000000000000"],
    ];

    for (const [field, value] of cases) {
      const answer = await updatePatient(orchestrator.cookiesOf(registration), { [field]: value });
      expect(answer.status).toBe(400);
      expect(await answer.json()).toEqual({ error: "invalid_input", fields: { [field]: ["immutable_field"] } });
    }

    const [row] = await patientsWithCpf(data.cpf);
    expect(row?.verified_at).toBeNull();
    expect(row?.verification_method).toBeNull();
    expect(row?.verified_municipality).toBeNull();
  });

  it("PD-23: update-user valida telefone e nascimento como o cadastro", async () => {
    const data = orchestrator.registrationData();
    const registration = await orchestrator.registerPatient(data);
    expect(registration.status).toBe(200);
    const cookie = orchestrator.cookiesOf(registration);
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ phone: "123" }, "phone"],
      [{ phone: 11987654321 }, "phone"],
      [{ birthDate: "1990-13-45" }, "birthDate"],
      [{ birthDate: tomorrow }, "birthDate"],
    ];

    for (const [body, key] of cases) {
      const answer = await updatePatient(cookie, body);
      expect(answer.status).toBe(400);
      const error = errorSchema.parse(await answer.json());
      expect(error.error).toBe("invalid_input");
      expect(Object.keys(error.fields ?? {})).toEqual([key]);
    }

    const valid = await updatePatient(cookie, { phone: "(21) 3456-7890", birthDate: "1985-01-02" });
    expect(valid.status).toBe(200);
    const [row] = await patientsWithCpf(data.cpf);
    expect(row).toMatchObject({ phone: "2134567890", birthDate: "1985-01-02" });
  });

  it("PD-22: e-mail já usado por outra conta → 409 email_in_use", async () => {
    const first = orchestrator.registrationData();
    expect((await orchestrator.registerPatient(first)).status).toBe(200);

    const answer = await orchestrator.registerPatient(orchestrator.registrationData({ email: first.email }));

    expect(answer.status).toBe(409);
    expect(await answer.json()).toEqual({ error: "email_in_use" });
  });

  it("PD-22: erros do próprio better-auth saem em português (senha curta, sem sessão, credenciais)", async () => {
    const data = orchestrator.registrationData();
    const registration = await orchestrator.registerPatient(data);
    expect(registration.status).toBe(200);

    const shortPassword = await callAuth("/change-password", {
      cookie: orchestrator.cookiesOf(registration),
      body: { currentPassword: data.password, newPassword: "1234567" },
    });
    expect(shortPassword.status).toBe(400);
    expect(await shortPassword.json()).toEqual({
      error: "invalid_input",
      fields: { password: ["password_too_short"] },
    });

    const withoutSession = await updatePatient("", { name: "Outra" });
    expect(withoutSession.status).toBe(401);
    expect(await withoutSession.json()).toEqual({ error: "not_authenticated" });

    const wrongPassword = await callAuth("/sign-in/username", {
      body: { username: data.cpf, password: "senha-errada-1" },
    });
    expect(wrongPassword.status).toBe(401);
    expect(await wrongPassword.json()).toEqual({ error: "invalid_credentials" });
  });

  it("RN-ID-04: login por e-mail não existe (só por CPF, onde as tentativas são contadas)", async () => {
    const data = orchestrator.registrationData();
    await orchestrator.registerPatient(data);
    const r = await callAuth("/sign-in/email", { body: { email: data.email, password: data.password } });
    expect(r.status).toBe(404);
  });

  it("PD-22: is-username-available não existe (não revela se o CPF tem conta)", async () => {
    const data = orchestrator.registrationData();
    expect((await orchestrator.registerPatient(data)).status).toBe(200);

    const answer = await callAuth("/is-username-available", { body: { username: data.cpf } });

    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({ error: "not_found" });
  });
});

function callAuth(path: string, { cookie, body }: { cookie?: string; body: unknown }) {
  return fetch(`${webserver.origin}/v1/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webserver.origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function updatePatient(cookie: string, body: unknown) {
  return callAuth("/update-user", { cookie, body });
}
