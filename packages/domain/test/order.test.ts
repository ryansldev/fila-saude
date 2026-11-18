import { describe, expect, it } from "vitest";
import { compareOrder, compareSuggestion, type OrderKey, type SuggestionKey } from "../src/order.ts";
import type { LegalPriority } from "../src/priority.ts";

const WITHOUT: LegalPriority = { groups: [], verified: false, verifiedAt: null };
const withValue = (...groups: LegalPriority["groups"]): LegalPriority => ({
  groups,
  verified: false,
  verifiedAt: null,
});

const key = (p: Partial<OrderKey> = {}): OrderKey => ({
  confirmedUrgency: false,
  risk: "routine",
  priority: WITHOUT,
  number: 1,
  ...p,
});
const sug = (p: Partial<SuggestionKey> = {}): SuggestionKey => ({
  confirmedUrgency: false,
  reassigned: false,
  risk: "routine",
  priority: WITHOUT,
  originalEntryDate: 1,
  id: "a",
  ...p,
});

function sort<T>(xs: T[], cmp: (a: T, b: T) => number): T[] {
  return [...xs].sort(cmp);
}

describe("compareOrder", () => {
  it("RN-ORD: urgência confirmada sempre primeiro", () => {
    const urg = key({ confirmedUrgency: true, risk: "routine", number: 9 });
    const high = key({ risk: "urgent", priority: withValue("elderly80"), number: 1 });
    for (const mode of ["risk", "priority"] as const) {
      expect(compareOrder(urg, high, mode)).toBeLessThan(0);
      expect(compareOrder(high, urg, mode)).toBeGreaterThan(0);
    }
  });

  it("RN-ORD: risco antes (padrão), depois prioridade legal, depois número", () => {
    const attention = key({ risk: "attention", number: 5 });
    const elderly = key({ priority: withValue("elderly"), number: 3 });
    expect(compareOrder(attention, elderly, "risk")).toBeLessThan(0);
    const urgent = key({ risk: "urgent", number: 9 });
    expect(compareOrder(urgent, attention, "risk")).toBeLessThan(0);
  });

  it("RN-ORD / AD-004: municipal rule switches legal before risk", () => {
    const attention = key({ risk: "attention", number: 5 });
    const elderly = key({ priority: withValue("elderly"), number: 3 });
    expect(compareOrder(attention, elderly, "priority")).toBeGreaterThan(0);
    expect(compareOrder(elderly, attention, "priority")).toBeLessThan(0);
    // dentro da mesma prioridade, o risco decide
    const a = key({ priority: withValue("pregnant"), risk: "urgent", number: 8 });
    const b = key({ priority: withValue("disability"), risk: "routine", number: 1 });
    expect(compareOrder(a, b, "priority")).toBeLessThan(0);
  });

  it("RN-ORD: 80+ antes de 60-79; grupos diferentes empatam e decide o número", () => {
    const i80 = key({ priority: withValue("elderly80"), number: 9 });
    const i60 = key({ priority: withValue("elderly"), number: 1 });
    expect(compareOrder(i80, i60, "risk")).toBeLessThan(0);
    const mgmt = key({ priority: withValue("pregnant"), number: 2 });
    const disability = key({ priority: withValue("disability"), number: 1 });
    expect(compareOrder(mgmt, disability, "risk")).toBeGreaterThan(0);
    expect(compareOrder(disability, mgmt, "risk")).toBeLessThan(0);
  });

  it("RN-ORD: empate de risco e prioridade resolve pelo número, o menor primeiro", () => {
    const a = key({ number: 7 });
    const b = key({ number: 3 });
    expect(compareOrder(a, b, "risk")).toBeGreaterThan(0);
    expect(compareOrder(b, a, "priority")).toBeLessThan(0);
    expect(compareOrder(a, a, "risk")).toBe(0);
  });

  it("RN-ORD: ordem total determinística independe da ordem de entrada", () => {
    const items = [
      key({ number: 4, risk: "attention" }),
      key({ number: 2 }),
      key({ number: 3, priority: withValue("autism") }),
      key({ number: 1, confirmedUrgency: true }),
      key({ number: 5, risk: "urgent" }),
    ];
    const expected = sort(items, (a, b) => compareOrder(a, b, "risk")).map((c) => c.number);
    expect(expected).toEqual([1, 5, 4, 3, 2]);
    const inverted = sort([...items].reverse(), (a, b) => compareOrder(a, b, "risk"));
    expect(inverted.map((c) => c.number)).toEqual(expected);
  });
});

describe("urgência confirmada pela triagem (AD-058, AD-059)", () => {
  it("vermelho em 1º e laranja antes de amarelo, mesmo com o município em prioridade legal antes", () => {
    const red = key({ confirmedUrgency: true, risk: "emergency", number: 9 });
    const orange80 = key({ confirmedUrgency: true, risk: "very_urgent", priority: withValue("elderly80"), number: 1 });
    const yellowPregnant = key({ confirmedUrgency: true, risk: "urgent", priority: withValue("pregnant"), number: 2 });
    const orange = key({ confirmedUrgency: true, risk: "very_urgent", number: 3 });
    expect(compareOrder(red, orange80, "priority")).toBeLessThan(0);
    expect(compareOrder(orange, yellowPregnant, "priority")).toBeLessThan(0);
    // Mesmo risco confirmado: a prioridade legal desempata.
    expect(compareOrder(orange80, orange, "priority")).toBeLessThan(0);
  });
});

describe("compareSuggestion", () => {
  it("RN-AL-02: urgência, remanejados, depois risco e prioridade, depois data", () => {
    const urgent = sug({ id: "u", confirmedUrgency: true, originalEntryDate: 1 });
    const reas = sug({ id: "r", reassigned: true, originalEntryDate: 2 });
    const attention = sug({ id: "at", risk: "attention", originalEntryDate: 5 });
    const elderly = sug({ id: "i", priority: withValue("elderly"), originalEntryDate: 3 });
    const routine = sug({ id: "ro", originalEntryDate: 50 });
    const ids = (mode: "risk" | "priority") =>
      sort([routine, elderly, attention, reas, urgent], (a, b) => compareSuggestion(a, b, mode)).map((s) => s.id);
    expect(ids("risk")).toEqual(["u", "r", "at", "i", "ro"]);
    expect(ids("priority")).toEqual(["u", "r", "i", "at", "ro"]);
  });

  it("RN-AL-02: urgência vence remanejada de risco maior", () => {
    const urg = sug({ id: "u", confirmedUrgency: true, risk: "routine" });
    const rem = sug({ id: "r", reassigned: true, risk: "urgent" });
    expect(compareSuggestion(urg, rem, "risk")).toBeLessThan(0);
  });

  it("RN-AL-02: remanejada vence risco e prioridade", () => {
    const rem = sug({ id: "r", reassigned: true });
    const high = sug({ id: "x", risk: "urgent", priority: withValue("elderly80") });
    expect(compareSuggestion(rem, high, "risk")).toBeLessThan(0);
    expect(compareSuggestion(rem, high, "priority")).toBeLessThan(0);
  });

  it("RN-AL-02: empate resolve pela data de entrada original e depois pelo id", () => {
    const old = sug({ id: "z", originalEntryDate: 10 });
    const fresh = sug({ id: "a", originalEntryDate: 20 });
    expect(compareSuggestion(old, fresh, "risk")).toBeLessThan(0);
    const x = sug({ id: "a", originalEntryDate: 10 });
    const y = sug({ id: "b", originalEntryDate: 10 });
    expect(compareSuggestion(x, y, "risk")).toBeLessThan(0);
    expect(compareSuggestion(y, x, "priority")).toBeGreaterThan(0);
    expect(compareSuggestion(x, x, "risk")).toBe(0);
  });
});
