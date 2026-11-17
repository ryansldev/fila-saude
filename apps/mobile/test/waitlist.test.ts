import type { MyEntry, UnitService } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import { canRedo, servicesWithList, signUpMode, signUpRequest } from "@/lib/sign-ups";
import { entrySituation, nextStep } from "@/lib/texts";

const SRV = "00000000-0000-4000-8000-0000000000aa";
const my = (x: Partial<MyEntry>): MyEntry => ({
  entryId: "00000000-0000-4000-8000-000000000001",
  person: "Ana",
  state: "waiting",
  service: "Clínico",
  unit: "UBS Centro",
  session: null,
  ticket: null,
  itemState: null,
  estimate: null,
  call: null,
  pendingChecks: [],
  leaveHome: false,
  confirmationDeadline: null,
  serviceId: SRV,
  forMe: true,
  birthDate: "1990-01-01",
  refusalEnds: false,
  canCancel: true,
  stage: null,
  triaged: false,
  referred: false,
  ...x,
});

describe("lista de espera no app (fatia 4)", () => {
  it("a tela de inscrição tem três modos pelo caminho: sessão, lista e refazer", () => {
    expect(signUpMode("lista")).toBe("list");
    expect(signUpMode("refazer")).toBe("redo");
    expect(signUpMode("00000000-0000-4000-8000-000000000009")).toBe("session");
  });

  it("cada modo envia para a sua rota; só a sessão confere antes ('/verificar')", () => {
    const ids = { sessionId: "s1", serviceId: "v1", entryId: "e1" };
    expect(signUpRequest("session", "exemplo", ids)).toEqual({
      send: "/v1/municipalities/exemplo/sessions/s1/sign-ups",
      check: "/v1/municipalities/exemplo/sessions/s1/sign-ups/check",
    });
    expect(signUpRequest("list", "exemplo", ids)).toEqual({
      send: "/v1/municipalities/exemplo/services/v1/entries",
      check: null,
    });
    expect(signUpRequest("redo", "exemplo", ids)).toEqual({
      send: "/v1/municipalities/exemplo/entries/e1/questionnaire",
      check: null,
    });
  });

  it("I1/I2: serviços da unidade; regulado e requisição explicam, quem já está na lista vê isso", () => {
    const services: UnitService[] = [
      { id: SRV, name: "Clínico", mode: "direct" },
      { id: "00000000-0000-4000-8000-0000000000bb", name: "Dentista", mode: "direct" },
      { id: "00000000-0000-4000-8000-0000000000cc", name: "Raio-X", mode: "referral" },
      { id: "00000000-0000-4000-8000-0000000000dd", name: "Cardiologia", mode: "regulated" },
    ];
    expect(servicesWithList(services, [my({})]).map((s) => [s.name, s.kind])).toEqual([
      ["Clínico", "in_list"],
      ["Dentista", "sign_in"],
      ["Raio-X", "referral"],
      ["Cardiologia", "regulated"],
    ]);
    // Quem foi para outra pessoa não impede "para mim".
    expect(servicesWithList(services, [my({ forMe: false })])[0]?.kind).toBe("sign_in");
  });

  it("RN-CONF-01: alocada diz até quando confirmar", () => {
    const e = my({
      state: "allocated",
      session: { id: "s", start: "2026-11-20T11:00:00.000Z", end: "2026-11-20T15:00:00.000Z", state: "planned" },
      confirmationDeadline: "2026-11-18T11:00:00.000Z",
    });
    expect(nextStep(e, entrySituation(e, 0), 0)).toBe("confirme até quarta, 18/11, às 8h.");
  });

  it("I9: refazer o questionário só na lista (aguardando, alocada, confirmada antes do dia)", () => {
    expect(canRedo(my({ state: "waiting" }))).toBe(true);
    expect(canRedo(my({ state: "allocated" }))).toBe(true);
    expect(canRedo(my({ state: "confirmed" }))).toBe(true);
    expect(canRedo(my({ state: "in_queue" }))).toBe(false);
    expect(canRedo(my({ state: "in_reserve" }))).toBe(false);
  });
});
