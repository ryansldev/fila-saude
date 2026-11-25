import { describe, expect, it } from "vitest";
import {
  applyTransition,
  ENTRY_TRANSITIONS,
  type EntryState,
  ITEM_TRANSITIONS,
  type ItemState,
  PAUSE_TRANSITIONS,
  SESSION_TRANSITIONS,
  type SessionState,
  singleTransition,
} from "../src/contracts.ts";
import { firstRule, type Machine, readTables } from "./specs-tables.ts";

const DATA = {
  entry: ENTRY_TRANSITIONS,
  item: ITEM_TRANSITIONS,
  session: SESSION_TRANSITIONS,
  pause: PAUSE_TRANSITIONS,
} as const;

const tuples = (rows: { de: string; qualifier?: string | undefined; event: string; for: string }[]) =>
  rows.map((l) => [l.de, l.qualifier ?? "", l.event, l.for].join(" | ")).sort();

const TABLES = readTables();

describe("contratos (AD-051)", () => {
  for (const machine of ["entry", "item", "session", "pause"] as Machine[]) {
    it(`contratos AD-051: toda linha das specs está nos dados (${machine})`, () => {
      const fromSpecs = TABLES.filter((l) => l.machine === machine);
      expect(fromSpecs.length).toBeGreaterThan(0);
      expect(tuples(DATA[machine])).toEqual(tuples(fromSpecs));
    });

    it(`contratos AD-051: condição, efeitos e spec são os textos das specs (${machine})`, () => {
      const fromSpecs = TABLES.filter((l) => l.machine === machine);
      const complete = (l: {
        de: string;
        qualifier?: string | undefined;
        event: string;
        for: string;
        forQualifier?: string | undefined;
        condition: string;
        effects: string;
        rule: string;
        spec: string;
      }) => [...tuples([l]), l.forQualifier ?? "", l.condition, l.effects, l.rule, l.spec].join(" ## ");
      expect(DATA[machine].map(complete).sort()).toEqual(fromSpecs.map(complete).sort());
    });
  }

  it("contratos AD-051: transição não listada é proibida", () => {
    expect(applyTransition(ENTRY_TRANSITIONS, "completed", "Paciente cancela")).toBeNull();
    expect(applyTransition(ENTRY_TRANSITIONS, "allocated", "Evento inexistente")).toBeNull();
    expect(applyTransition(ENTRY_TRANSITIONS, "confirmed", "Sessão abre")).toBe("in_queue");
    expect(applyTransition(ITEM_TRANSITIONS, "called", "Rechamar")).toBe("(mesmo)");
    expect(applyTransition(SESSION_TRANSITIONS, "planned", "Cancela")).toBe("cancelled");
  });

  it("contratos AD-051: estados finais não têm saída, exceto a reversão da contingência", () => {
    const exits = <S extends string>(t: { de: S | "—"; event: string; for: string }[], final: S[]) =>
      t.filter((x) => (final as string[]).includes(x.de)).map((x) => `${x.de} | ${x.event} | ${x.for}`);
    const finalEntryStates: EntryState[] = ["completed", "cancelled", "closed_without_care"];
    const finalItemStates: ItemState[] = ["left_queue", "reassigned"];
    const finalSessionStates: SessionState[] = ["cancelled", "closed"];
    expect(exits(ENTRY_TRANSITIONS, finalEntryStates)).toHaveLength(1);
    const reversal = ENTRY_TRANSITIONS.find((x) => x.de === "closed_without_care");
    expect(reversal?.for).toBe("reassigned");
    expect(reversal?.spec).toBe("contingencia");
    expect(exits(ITEM_TRANSITIONS, finalItemStates)).toEqual([]);
    expect(exits(SESSION_TRANSITIONS, finalSessionStates)).toEqual([]);
  });

  it("contratos AD-051: transição ambígua lança erro (chamado + Não compareceu)", () => {
    expect(() => applyTransition(ITEM_TRANSITIONS, "called", '"Não compareceu"')).toThrow(
      /transição ambígua.*called.*Não compareceu/,
    );
  });

  it("contratos AD-051: linhas com o mesmo (de, evento) e o mesmo destino devolvem esse destino", () => {
    const shared = [ENTRY_TRANSITIONS, ITEM_TRANSITIONS, SESSION_TRANSITIONS].flatMap((table) =>
      (table as { de: string; event: string; for: string }[]).filter(
        (a, i, all) => all.findIndex((b) => b.de === a.de && b.event === a.event) !== i,
      ),
    );
    expect(shared.length).toBeGreaterThan(0);
    // cada grupo repetido é ambíguo ou unânime; os unânimes não lançam (hoje nenhum grupo real é unânime)
    const row = ITEM_TRANSITIONS.find((t) => t.de === "present" && t.for === "called");
    if (!row) throw new Error("contrato: sem linha de presente a chamado");
    const twice = [row, { ...row, condition: "outra condição" }];
    expect(applyTransition(twice, "present" as ItemState, row.event)).toBe("called");
  });

  it("contratos AD-051: regra é o primeiro ID de regra em condição + efeitos, ou vazio", () => {
    for (const table of [ENTRY_TRANSITIONS, ITEM_TRANSITIONS, SESSION_TRANSITIONS]) {
      for (const t of table) expect(t.rule, `${t.de} | ${t.event}`).toBe(firstRule(`${t.condition} ${t.effects}`));
    }
  });

  it("contratos AD-051: transicaoUnica devolve a linha única, null sem linha e lança se ambígua", () => {
    expect(singleTransition(ENTRY_TRANSITIONS, "allocated", "Evento inexistente")).toBeNull();
    expect(singleTransition(ENTRY_TRANSITIONS, "archived", 'Serviço muda para "regulado"')?.for).toBe("cancelled");
    const free = 'Serviço muda para "livre"';
    expect(() => singleTransition(ENTRY_TRANSITIONS, "awaiting_referral", free)).toThrow(
      /contrato: mais de uma linha.*awaiting_referral/,
    );
    const withSlot = singleTransition(
      ENTRY_TRANSITIONS,
      "awaiting_referral",
      free,
      (t) => t.qualifier === "vaga segura",
    );
    expect(withSlot?.for).toBe("confirmed");
    expect(
      singleTransition(ENTRY_TRANSITIONS, "awaiting_referral", free, (t) => t.qualifier === "inexistente"),
    ).toBeNull();
  });
});
