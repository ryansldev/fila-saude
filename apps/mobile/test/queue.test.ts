import type { MyEntry } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import { queueHighlight, queueSteps } from "@/lib/queue";
import { entrySituation } from "@/lib/texts";

const base: MyEntry = {
  entryId: "00000000-0000-4000-8000-000000000001",
  person: "Bruno",
  state: "in_queue",
  service: "Curativos",
  unit: "UBS Centro",
  session: {
    id: "00000000-0000-4000-8000-000000000002",
    start: "2026-11-14T11:00:00.000Z",
    end: "2026-11-14T15:00:00.000Z",
    state: "open",
  },
  ticket: "V-002",
  itemState: "remote",
  estimate: { kind: "position", position: 3, minutes: 20 },
  call: null,
  pendingChecks: [],
  leaveHome: false,
  confirmationDeadline: null,
  serviceId: "00000000-0000-4000-8000-0000000000aa",
  forMe: true,
  birthDate: "1992-08-15",
  refusalEnds: false,
  canCancel: true,
  stage: "care",
  triaged: false,
  referred: false,
};
const SESSION_PLANNED = {
  id: "00000000-0000-4000-8000-000000000002",
  start: "2026-11-14T13:00:00.000Z",
  end: "2026-11-14T15:00:00.000Z",
  state: "planned",
};
const NOW = Date.parse("2026-11-14T12:00:00.000Z");
const steps = (en: MyEntry) => queueSteps(en, entrySituation(en, NOW)).map((p) => `${p.id}:${p.state}`);
const highlight = (en: MyEntry) => queueHighlight(en, entrySituation(en, NOW));

describe("tela da fila: linha do tempo", () => {
  it("sem triagem: inscrição, em casa, na unidade, atendimento; em casa é a etapa de agora", () => {
    expect(steps(base)).toEqual(["sign_up:done", "home:current", "unit:future", "care:future"]);
  });

  it("na unidade e chamado na sala", () => {
    const present = {
      ...base,
      itemState: "present" as const,
      estimate: { kind: "position" as const, position: 1, minutes: 0 },
    };
    expect(steps(present)).toEqual(["sign_up:done", "home:done", "unit:current", "care:future"]);
    const turn = {
      ...base,
      itemState: "called" as const,
      call: { station: "Sala 1", at: base.session?.start ?? "" },
    };
    expect(steps(turn)).toEqual(["sign_up:done", "home:done", "unit:done", "care:current"]);
  });

  it("com triagem: a triagem aparece; depois dela, o atendimento é a etapa de agora (mesmo em casa)", () => {
    const inTriage = { ...base, stage: "triage" as const, itemState: "present" as const };
    expect(steps(inTriage)).toEqual(["sign_up:done", "home:done", "unit:current", "triage:future", "care:future"]);
    const calledInTriage = {
      ...inTriage,
      itemState: "called" as const,
      call: { station: "Triagem 1", at: "" },
    };
    expect(steps(calledInTriage)[3]).toBe("triage:current");
    const homeTriaged = { ...base, triaged: true };
    expect(steps(homeTriaged)).toEqual(["sign_up:done", "home:done", "unit:done", "triage:done", "care:current"]);
  });

  it("antes da fila abrir, 'em casa' é a de agora mas ainda não começou; atendido completa tudo", () => {
    const signedUp = {
      ...base,
      state: "confirmed",
      ticket: null,
      itemState: null,
      estimate: null,
      session: SESSION_PLANNED,
    };
    expect(steps(signedUp)).toEqual(["sign_up:done", "home:pending", "unit:future", "care:future"]);
    const attended = { ...base, state: "completed", itemState: "done_in_stage" as const };
    expect(steps(attended).every((p) => p.endsWith(":done"))).toBe(true);
  });

  it("encerrado sem atendimento (cancelado, saiu, encaminhado) não tem linha do tempo", () => {
    expect(steps({ ...base, state: "cancelled", itemState: null })).toEqual([]);
    expect(steps({ ...base, state: "completed", itemState: "done_in_stage", referred: true })).toEqual([]);
  });
});

describe("tela da fila: o destaque (senha grande)", () => {
  it("na fila: senha, posição e tempo", () => {
    expect(highlight(base)).toEqual({ tone: "blue", label: "sua senha", ticket: "V-002", position: 3, minutes: 20 });
  });

  it("é a sua vez: verde, com a sala", () => {
    const turn = { ...base, itemState: "called" as const, call: { station: "Sala 1", at: "" } };
    expect(highlight(turn)).toEqual({ tone: "green", label: "é a sua vez!", ticket: "V-002", room: "sala 1" });
  });

  it("venha agora e recepção: amarelo", () => {
    expect(highlight({ ...base, estimate: { kind: "come_now" } })).toMatchObject({
      tone: "yellow",
      label: "venha agora",
    });
    expect(highlight({ ...base, pendingChecks: ["account"] })).toMatchObject({
      tone: "yellow",
      label: "mostre na recepção",
    });
  });

  it("sem senha ainda: diz quando ela sai", () => {
    const signedUp = {
      ...base,
      state: "confirmed",
      ticket: null,
      itemState: null,
      estimate: null,
      session: SESSION_PLANNED,
    };
    expect(highlight(signedUp)).toEqual({ tone: "gray", label: "a senha sai quando a fila abrir", ticket: null });
  });
});
