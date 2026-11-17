import type { MyEntry } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  activeEntry,
  checkError,
  declaration,
  doneTitle,
  forMeInService,
  otherPersonAlreadySignedUp,
  RELATIONSHIPS,
  sameName,
  samePerson,
  signUpForWhom,
  signUpInSchedule,
  stepOfError,
} from "@/lib/sign-ups";

const DRESSINGS = "00000000-0000-4000-8000-0000000000aa";
const GENERAL = "00000000-0000-4000-8000-0000000000bb";
const SESSION_1 = "00000000-0000-4000-8000-000000000101";
const SESSION_2 = "00000000-0000-4000-8000-000000000102";

const base: MyEntry = {
  entryId: "00000000-0000-4000-8000-000000000001",
  person: "Ana Souza",
  state: "confirmed",
  service: "Curativos",
  unit: "UBS Centro",
  session: { id: SESSION_1, start: "2026-11-20T11:00:00Z", end: "2026-11-20T15:00:00Z", state: "planned" },
  ticket: null,
  itemState: null,
  estimate: null,
  call: null,
  pendingChecks: [],
  leaveHome: false,
  confirmationDeadline: null,
  serviceId: DRESSINGS,
  forMe: true,
  birthDate: "1990-05-05",
  refusalEnds: false,
  canCancel: true,
  stage: null,
  triaged: false,
  referred: false,
};

describe("uma inscrição ativa por pessoa e serviço (AD-032), decidido antes de enviar", () => {
  it("entrada ativa: tudo que não terminou; as finais não contam", () => {
    // Remanejada continua ativa: a pessoa segue no serviço esperando a nova data.
    for (const state of ["confirmed", "in_queue", "in_reserve", "waiting", "allocated", "reassigned"])
      expect(activeEntry({ ...base, state })).toBe(true);
    for (const state of ["cancelled", "completed", "closed_without_care", "archived"])
      expect(activeEntry({ ...base, state })).toBe(false);
  });

  it("agenda: o selo diz como o dono está no serviço; o cartão ainda inscreve outra pessoa", () => {
    const s1 = { id: SESSION_1, service: { id: DRESSINGS } };
    const s2 = { id: SESSION_2, service: { id: DRESSINGS } };
    expect(signUpInSchedule(s1, [base])).toEqual({
      kind: "signed_up",
      badge: "inscrito",
      canOther: true,
    });
    expect(signUpInSchedule(s2, [base])).toMatchObject({ badge: "já tem data" });
    expect(signUpInSchedule(s2, [{ ...base, state: "waiting", session: null }])).toMatchObject({
      badge: "lista de espera",
    });
    expect(signUpInSchedule(s1, [{ ...base, state: "in_reserve" }])).toMatchObject({
      badge: "na reserva",
    });
    expect(signUpInSchedule(s2, [{ ...base, state: "reassigned" }])).toMatchObject({
      badge: "nova data",
    });
  });

  it("agenda: com o limite de pessoas da conta nesta data, não há o que fazer além de ver minha fila", () => {
    const s1 = { id: SESSION_1, service: { id: DRESSINGS } };
    const others = [1, 2, 3, 4].map((i) => ({ ...base, entryId: `e${i}`, forMe: false, person: `P${i}` }));
    expect(signUpInSchedule(s1, [base, ...others])).toMatchObject({ kind: "signed_up", canOther: false });
    expect(signUpInSchedule(s1, [base, ...others.slice(1)])).toMatchObject({ canOther: true });
  });

  it("agenda: outro serviço, entrada encerrada ou só outra pessoa da conta → livre", () => {
    const s = { id: SESSION_1, service: { id: DRESSINGS } };
    expect(signUpInSchedule({ id: SESSION_1, service: { id: GENERAL } }, [base])).toEqual({ kind: "free" });
    expect(signUpInSchedule(s, [{ ...base, state: "cancelled" }])).toEqual({ kind: "free" });
    expect(signUpInSchedule(s, [{ ...base, forMe: false, person: "João" }])).toEqual({ kind: "free" });
    expect(signUpInSchedule(s, [])).toEqual({ kind: "free" });
    // "minhas" ainda não chegou (ou falhou): não bloqueia; a API ainda recusa a duplicada.
    expect(signUpInSchedule(s, null)).toEqual({ kind: "free" });
  });

  it("para quem é: 'para mim' bloqueado só quando o dono já tem entrada ativa no serviço", () => {
    expect(forMeInService([base], DRESSINGS)).toBe(true);
    expect(forMeInService([base], GENERAL)).toBe(false);
    expect(forMeInService([{ ...base, state: "completed" }], DRESSINGS)).toBe(false);
    expect(forMeInService([{ ...base, forMe: false }], DRESSINGS)).toBe(false);
    expect(forMeInService(null, DRESSINGS)).toBe(false);
    expect(forMeInService([base], undefined)).toBe(false);
  });

  it("mesmo nome: sem diferença de maiúsculas, acentos e espaços", () => {
    expect(sameName("  João   da Silva ", "joao da silva")).toBe(true);
    expect(sameName("João Silva", "João Souza")).toBe(false);
    expect(sameName("", "")).toBe(false);
  });

  it("mesma pessoa (RN-LE-02): CPF quando os dois têm; senão nome e nascimento", () => {
    const joao = { name: "João da Silva", birthDate: "2010-01-02", cpf: "529.982.247-25" };
    expect(samePerson(joao, { ...joao, name: "Outro Nome", cpf: "52998224725" })).toBe(true);
    expect(samePerson(joao, { ...joao, cpf: "111.444.777-35" })).toBe(false);
    expect(samePerson(joao, { name: "joao da silva", birthDate: "2010-01-02", cpf: null })).toBe(true);
    expect(samePerson(joao, { name: "joao da silva", birthDate: "2010-01-03" })).toBe(false);
    expect(samePerson(joao, { name: "joao da silva", birthDate: "" })).toBe(false);
  });

  it("outra pessoa já inscrita no serviço pela conta: nome + nascimento, só entradas ativas que não são do dono", () => {
    const joao = { ...base, forMe: false, person: "João da Silva", birthDate: "2010-01-02" };
    const typed = { name: "joão da  silva", birthDate: "2010-01-02", cpf: "" };
    expect(otherPersonAlreadySignedUp([joao], DRESSINGS, typed)).toBe(true);
    // Homônimo com outra data de nascimento é outra pessoa.
    expect(otherPersonAlreadySignedUp([joao], DRESSINGS, { ...typed, birthDate: "2011-01-02" })).toBe(false);
    // Data ainda incompleta (dataIso vazio): não acusa nada antes da hora.
    expect(otherPersonAlreadySignedUp([joao], DRESSINGS, { ...typed, birthDate: "" })).toBe(false);
    expect(otherPersonAlreadySignedUp([joao], GENERAL, typed)).toBe(false);
    expect(otherPersonAlreadySignedUp([{ ...joao, state: "cancelled" }], DRESSINGS, typed)).toBe(false);
    expect(otherPersonAlreadySignedUp([{ ...joao, state: "reassigned" }], DRESSINGS, typed)).toBe(true);
    // O dono não é "outra pessoa", mesmo com o mesmo nome digitado.
    expect(otherPersonAlreadySignedUp([base], DRESSINGS, { name: "Ana Souza", birthDate: "1990-05-05" })).toBe(false);
    expect(otherPersonAlreadySignedUp(null, DRESSINGS, typed)).toBe(false);
  });
});

describe("conferência antes do questionário (/verificar): onde o erro aparece no passo 'para quem'", () => {
  const error = (code: string, message?: string) => new ApiError(409, code, message);

  it("CPF da conta, pessoa com conta e CPF inválido: embaixo do CPF", () => {
    expect(checkError(error("own_account_cpf", "Esse é o seu CPF."))).toEqual({
      kind: "field",
      field: "cpf",
      text: 'esse é o seu CPF. para você, escolha "para mim".',
    });
    expect(checkError(error("person_has_account"))).toMatchObject({ kind: "field", field: "cpf" });
    expect(checkError(new ApiError(400, "invalid_cpf"))).toMatchObject({ kind: "field", field: "cpf" });
  });

  it("dados que não batem com o CPF: embaixo do nome e da data", () => {
    expect(checkError(error("person_mismatch"))).toMatchObject({ kind: "person" });
  });

  it("sessão fechada ou privada: faixa com saída para os atendimentos; limite, requisição e duplicada: minha fila", () => {
    expect(checkError(error("session_closed"))).toMatchObject({ kind: "banner", exit: "schedule" });
    expect(checkError(error("private_session"))).toMatchObject({ kind: "banner", exit: "schedule" });
    const limit = checkError(error("limit_per_account", "Uma conta inscreve até 5 pessoas."));
    expect(limit).toMatchObject({ kind: "banner", exit: "queue", text: "Uma conta inscreve até 5 pessoas." });
    expect(checkError(error("referral_pending"))).toMatchObject({ kind: "banner", exit: "queue" });
    expect(checkError(error("duplicate"))).toMatchObject({ kind: "banner", exit: "queue" });
  });

  it("sem internet ou outro erro: faixa sem saída (tentar de novo)", () => {
    expect(checkError(new ApiError(0, "no_connection"))).toMatchObject({ kind: "banner", exit: null });
  });
});

describe("inscrição para outra pessoa: a relação (2026-11-16)", () => {
  it("as três relações, como as pessoas se veem, sem '(a)'", () => {
    expect(RELATIONSHIPS.map((r) => [r.id, r.text("Ana")])).toEqual([
      ["legal_guardian", "sou mãe, pai ou responsável legal de Ana"],
      ["caregiver", "cuido de Ana no dia a dia"],
      ["family_or_friend", "sou da família ou amigo de Ana e estou ajudando"],
    ]);
  });

  it("só o responsável legal declara que responde pela pessoa; os outros, que ela sabe e concorda", () => {
    expect(declaration("legal_guardian", "Ana")).toBe("declaro que sou responsável legal por Ana");
    expect(declaration("caregiver", "Ana")).toBe("Ana sabe e concorda com esta inscrição");
    expect(declaration("family_or_friend", "Ana")).toBe("Ana sabe e concorda com esta inscrição");
  });

  it("recusa da conferência num dado volta para a tela dele", () => {
    expect(stepOfError({ kind: "field", field: "cpf", text: "x" })).toBe("cpf");
    expect(stepOfError({ kind: "person", text: "x" })).toBe("name");
    expect(stepOfError({ kind: "banner", title: "x", text: "y", exit: null })).toBeNull();
  });
});

describe("o 'pronto!' da inscrição, sem '(a)'", () => {
  it("para mim e para outra pessoa", () => {
    expect(doneTitle("signed_up", "me", "")).toEqual({ title: "prontinho!", text: "a vaga é sua." });
    expect(doneTitle("signed_up", "other", "Ana")).toEqual({
      title: "prontinho!",
      text: "a vaga de Ana está garantida.",
    });
    expect(doneTitle("list", "me", "")).toEqual({ title: "prontinho!", text: "você está na lista de espera." });
    expect(doneTitle("list", "other", "Ana").text).toBe("Ana está na lista de espera.");
    expect(doneTitle("reserve", "other", "Ana")).toEqual({
      title: "as vagas acabaram",
      text: "Ana está na lista de reserva desta data.",
    });
    expect(doneTitle("request", "me", "").title).toBe("falta o pedido médico");
    expect(doneTitle("redone", "me", "")).toEqual({
      title: "respostas atualizadas",
      text: "a unidade já vê as respostas novas.",
    });
  });
});

describe("o 'para quem' enviado à API (review 2026-11-16)", () => {
  const ana = { name: " Ana Souza ", birthDate: "07/07/2019", cpf: "" };

  it("para mim não leva dados", () => {
    expect(signUpForWhom("me", ana, null, false)).toEqual({ kind: "me" });
  });

  it("outra pessoa só com a relação escolhida e a declaração marcada de verdade", () => {
    expect(signUpForWhom("other", ana, null, true)).toBeNull();
    expect(signUpForWhom("other", ana, "caregiver", false)).toBeNull();
    expect(signUpForWhom("other", ana, "caregiver", true)).toEqual({
      kind: "other",
      name: "Ana Souza",
      birthDate: "2019-07-07",
      cpf: null,
      relationship: "caregiver",
      declared: true,
    });
  });
});
