import { describe, expect, it } from "vitest";
import type { EntryState } from "../src/contracts.ts";
import { canChangeRequiresTriage, changeServiceMode, countActive } from "../src/service.ts";
import { freeze } from "./fixtures.ts";

type E = { id: string; state: EntryState; safeSlot: boolean; sessionOpened: boolean };
const e = (id: string, state: EntryState, extra: Partial<E> = {}): E =>
  freeze({ id, state, safeSlot: false, sessionOpened: false, ...extra });

describe("changeServiceMode", () => {
  it("RN-ENC-07: troca para regulado bloqueada com entradas ativas, com a contagem", () => {
    const entries = freeze([
      e("a", "waiting"),
      e("b", "in_queue"),
      e("c", "archived"),
      e("d", "completed"),
      e("f", "cancelled"),
      e("g", "closed_without_care"),
    ]);
    expect(changeServiceMode("direct", "regulated", entries)).toEqual({ ok: false, error: "regulated_service" });
    expect(changeServiceMode("referral", "regulated", entries)).toEqual({ ok: false, error: "regulated_service" });
    expect(countActive(entries)).toBe(2);
    expect(countActive([e("x", "completed"), e("y", "archived")])).toBe(0);
    expect(countActive([e("r", "in_reserve"), e("s", "reassigned")])).toBe(2);
    expect(changeServiceMode("direct", "regulated", [e("r", "in_reserve")])).toEqual({
      ok: false,
      error: "regulated_service",
    });
  });

  it("RN-ENC-07: arquivadas são canceladas com push", () => {
    const entries = freeze([e("a", "archived"), e("b", "completed"), e("c", "archived")]);
    const r = changeServiceMode("referral", "regulated", entries);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.changes).toEqual([
      { id: "a", for: "cancelled", push: true },
      { id: "c", for: "cancelled", push: true },
    ]);
    expect(entries[0]?.state).toBe("archived");
  });

  it("RN-ENC-07: aguardando encaminhamento vira aguardando ao virar livre", () => {
    const entries = freeze([e("a", "awaiting_referral"), e("b", "waiting"), e("c", "allocated")]);
    const r = changeServiceMode("referral", "direct", entries);
    expect(r.ok && r.state.changes).toEqual([{ id: "a", for: "waiting", push: false }]);
  });

  it("RN-ENC-07: vaga segura vira confirmada com push antes da abertura", () => {
    const entries = freeze([
      e("a", "awaiting_referral", { safeSlot: true }),
      e("b", "awaiting_referral", { safeSlot: true, sessionOpened: true }),
    ]);
    const r = changeServiceMode("referral", "direct", entries);
    expect(r.ok && r.state.changes).toEqual([
      { id: "a", for: "confirmed", push: true },
      { id: "b", for: "waiting", push: false },
    ]);
  });

  it("AD-038: livre para requisição não exige foto de quem já está na lista", () => {
    const entries = freeze([e("a", "waiting"), e("b", "confirmed", { safeSlot: true }), e("c", "archived")]);
    const r = changeServiceMode("direct", "referral", entries);
    expect(r.ok && r.state.changes).toEqual([]);
  });

  it("RN-ENC-07: mesmo modo não muda nada", () => {
    const r = changeServiceMode("referral", "referral", [e("a", "awaiting_referral")]);
    expect(r.ok && r.state.changes).toEqual([]);
  });
});

describe("canChangeRequiresTriage", () => {
  it("RN-TRI-01: exige triagem não muda com sessão aberta", () => {
    expect(canChangeRequiresTriage([])).toBe(true);
    expect(canChangeRequiresTriage([{ state: "planned" }, { state: "closed" }, { state: "cancelled" }])).toBe(true);
    expect(canChangeRequiresTriage([{ state: "planned" }, { state: "open" }])).toBe(false);
  });
});
