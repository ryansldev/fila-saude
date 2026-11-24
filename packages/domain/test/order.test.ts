import { describe, expect, it } from "vitest";
import {
  compareOrder,
  compareSuggestion,
  type OrderKey,
  orderItems,
  orderSuggestions,
  precedes,
  type SuggestionKey,
} from "../src/order.ts";
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

  it("RN-ORD: entre dois com prioridade, sem hierarquia de grupo, decide o número (o 80+ só pela ordem da fila)", () => {
    const i80 = key({ priority: withValue("elderly80"), number: 9 });
    const i60 = key({ priority: withValue("elderly"), number: 1 });
    expect(compareOrder(i80, i60, "risk")).toBeGreaterThan(0);
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
    // Mesmo risco confirmado: a prioridade legal desempata (com prioridade antes de sem).
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

describe("RV7: 80+ antes dos demais idosos, sem hierarquia entre grupos (Lei 10.741, art. 3º, § 2º; Lei 10.048)", () => {
  type P = { name: string } & OrderKey;
  const p = (name: string, groups: LegalPriority["groups"], number: number, extra: Partial<OrderKey> = {}): P => ({
    name,
    ...key({ priority: withValue(...groups), number, ...extra }),
  });
  const names = (xs: P[]) => xs.map((x) => x.name);
  const order = (xs: P[], mode: "risk" | "priority" = "risk") => names(orderItems(xs, (x) => x, mode));

  it("as vagas dos idosos vão primeiro aos 80+; os outros grupos ficam no lugar da senha", () => {
    const bia = p("Bia, 70", ["elderly"], 1);
    const gil = p("Gil, gestante", ["pregnant"], 2);
    const ana = p("Ana, 85", ["elderly80"], 3);
    expect(order([bia, gil, ana])).toEqual(["Ana, 85", "Gil, gestante", "Bia, 70"]);
    // Qualquer ordem de entrada dá a mesma fila (sem ciclo).
    expect(order([ana, gil, bia])).toEqual(["Ana, 85", "Gil, gestante", "Bia, 70"]);
    expect(order([gil, ana, bia])).toEqual(["Ana, 85", "Gil, gestante", "Bia, 70"]);
  });

  it("entre os 80+, e entre os 60-79, decide a senha", () => {
    const xs = [p("Ivo, 61", ["elderly"], 1), p("Lia, 90", ["elderly80"], 4), p("Rui, 81", ["elderly80"], 2)];
    expect(order(xs)).toEqual(["Rui, 81", "Lia, 90", "Ivo, 61"]);
  });

  it("sem idoso 60-79 na frente, o 80+ não passa ninguém", () => {
    const xs = [
      p("Gil, gestante", ["pregnant"], 1),
      p("Pedro, PcD", ["disability"], 2),
      p("Ana, 85", ["elderly80"], 3),
    ];
    expect(order(xs)).toEqual(["Gil, gestante", "Pedro, PcD", "Ana, 85"]);
  });

  it("não troca entre riscos, urgências ou com quem não tem prioridade", () => {
    const bia = p("Bia, 70", ["elderly"], 1, { risk: "attention" });
    const ana = p("Ana, 85", ["elderly80"], 2);
    expect(order([ana, bia])).toEqual(["Bia, 70", "Ana, 85"]);
    // Prioridade antes do risco: os dois no mesmo bloco de prioridade, mas riscos diferentes.
    expect(order([ana, bia], "priority")).toEqual(["Bia, 70", "Ana, 85"]);
    const semPrioridade = p("Caio", [], 1);
    expect(order([p("Ana, 85", ["elderly80"], 3), semPrioridade])).toEqual(["Ana, 85", "Caio"]);
  });

  it("idosa de 60-79 que também é de outro grupo (PcD) fica no lugar da senha (D5)", () => {
    const bia = p("Bia, 70 + PcD", ["elderly", "disability"], 1);
    const gil = p("Gil, gestante", ["pregnant"], 2);
    const ana = p("Ana, 85", ["elderly80"], 3);
    expect(order([bia, gil, ana])).toEqual(["Bia, 70 + PcD", "Gil, gestante", "Ana, 85"]);
  });

  it("80+ que também é de outro grupo não perde a vaga de idoso (declarar mais um grupo nunca piora)", () => {
    const bia = p("Bia, 70", ["elderly"], 1);
    const ana = p("Ana, 85 + PcD", ["elderly80", "disability"], 3);
    expect(order([bia, ana])).toEqual(["Ana, 85 + PcD", "Bia, 70"]);
    expect(precedes(ana, bia, "risk")).toBe(true);
  });

  it("entre dois, sem a fila: o 80+ só passa um idoso de 60-79 do mesmo bloco; os outros pela senha", () => {
    const bia = p("Bia, 70", ["elderly"], 1);
    const gil = p("Gil, gestante", ["pregnant"], 2);
    const ana = p("Ana, 85", ["elderly80"], 3);
    expect(precedes(ana, bia, "risk")).toBe(true);
    expect(precedes(bia, ana, "risk")).toBe(false);
    expect(precedes(gil, ana, "risk")).toBe(true);
    expect(precedes(ana, gil, "risk")).toBe(false);
    expect(precedes(ana, p("Bia, 70 + PcD", ["elderly", "disability"], 1), "risk")).toBe(false);
    expect(precedes(ana, p("Bia, 70", ["elderly"], 1, { risk: "attention" }), "risk")).toBe(false);
  });

  it("a sugestão de alocação da lista de espera segue a mesma regra", () => {
    type S = { name: string } & SuggestionKey;
    const s = (name: string, groups: LegalPriority["groups"], originalEntryDate: number): S => ({
      name,
      ...sug({ id: name, priority: withValue(...groups), originalEntryDate }),
    });
    const xs = [s("Bia, 70", ["elderly"], 1), s("Gil, gestante", ["pregnant"], 2), s("Ana, 85", ["elderly80"], 3)];
    expect(orderSuggestions(xs, (x) => x, "risk").map((x) => x.name)).toEqual(["Ana, 85", "Gil, gestante", "Bia, 70"]);
  });
});
