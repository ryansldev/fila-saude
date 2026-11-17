import { describe, expect, it } from "vitest";
import {
  expired,
  GROUPS,
  type Group,
  groupFromDeclared,
  hasPriority,
  type LegalPriority,
  personPriority,
  rankPriority,
} from "../src/priority.ts";

const TIME_ZONE = "America/Sao_Paulo";
const at = (iso: string) => Date.parse(iso);
const legal = (groups: Group[], verified = false, verifiedAt: number | null = null): LegalPriority => ({
  groups,
  verified,
  verifiedAt,
});

describe("prioridade legal (RN-RISCO-04)", () => {
  it("RN-RISCO-04: idoso vem da data de nascimento, 80+ acima dos demais", () => {
    const now = at("2026-06-15T15:00:00Z");
    expect(personPriority({ birthDate: "1950-01-01" }, [], now, TIME_ZONE)).toEqual(["elderly"]);
    expect(personPriority({ birthDate: "1940-01-01" }, [], now, TIME_ZONE)).toEqual(["elderly80"]);
    expect(personPriority({ birthDate: "1990-01-01" }, [], now, TIME_ZONE)).toEqual([]);
    expect(rankPriority(legal(["elderly80"]))).toBe(2);
    expect(rankPriority(legal(["elderly"]))).toBe(1);
    expect(rankPriority(legal(["elderly", "elderly80"]))).toBe(2);
    expect(rankPriority(legal([]))).toBe(0);
  });

  it("RN-RISCO-04: idoso não pode ser declarado, só vem da idade", () => {
    const now = at("2026-06-15T15:00:00Z");
    expect(personPriority({ birthDate: "1990-01-01" }, ["elderly", "elderly80"], now, TIME_ZONE)).toEqual([]);
  });

  it("RN-RISCO-04: entre grupos diferentes não há hierarquia", () => {
    expect(rankPriority(legal(["pregnant"]))).toBe(1);
    expect(rankPriority(legal(["disability"]))).toBe(1);
    expect(rankPriority(legal(["pregnant"]))).toBe(rankPriority(legal(["disability"])));
    expect(rankPriority(legal(["pregnant", "disability", "autism"]))).toBe(1);
  });

  it("AD-027: prioridade do acompanhante não passa ao atendido", () => {
    const now = at("2026-06-15T15:00:00Z");
    // O acompanhante (idoso, gestante) não entra: só a pessoa atendida e o que ela declara.
    expect(personPriority({ birthDate: "2000-01-01" }, [], now, TIME_ZONE)).toEqual([]);
  });

  it("AD-027: criança de colo atendida mantém colo", () => {
    const now = at("2026-06-15T15:00:00Z");
    expect(personPriority({ birthDate: "2025-09-01" }, ["infant"], now, TIME_ZONE)).toEqual(["infant"]);
  });

  it("AD-025: mobilidade reduzida e doador de sangue estão na lista", () => {
    expect(Object.keys(GROUPS)).toEqual(
      expect.arrayContaining([
        "mobility",
        "donor",
        "obesity",
        "breastfeeding",
        "autism",
        "disability",
        "infant",
        "pregnant",
      ]),
    );
    expect(GROUPS.mobility.verification).toBe("to_define");
    expect(GROUPS.donor.verification).toBe("to_define");
    expect(GROUPS.elderly).toEqual({ verification: "birthDate", expiresInDays: null });
    expect(GROUPS.elderly80).toEqual({ verification: "birthDate", expiresInDays: null });
    expect(GROUPS.pregnant.verification).toBe("visual");
    expect(GROUPS.infant.verification).toBe("visual");
    expect(GROUPS.disability.verification).toBe("document");
    expect(GROUPS.autism.verification).toBe("document");
    expect(groupFromDeclared("reduced_mobility")).toBe("mobility");
    expect(groupFromDeclared("blood_donor")).toBe("donor");
    expect(groupFromDeclared("infant_in_arms")).toBe("infant");
    expect(groupFromDeclared("pregnant")).toBe("pregnant");
  });

  it("RN-RISCO-04: 59 anos não é idoso, 60 no dia do aniversário é (L-004)", () => {
    const birth = "1966-06-15";
    // Antes das 00:00 de 15/06 em São Paulo (03:00Z): ainda 59.
    expect(personPriority({ birthDate: birth }, [], at("2026-06-15T02:59:59Z"), TIME_ZONE)).toEqual([]);
    expect(personPriority({ birthDate: birth }, [], at("2026-06-15T03:00:00Z"), TIME_ZONE)).toEqual(["elderly"]);
  });

  it("RN-RISCO-04: 79 anos é idoso, 80 no dia do aniversário é idoso80 (L-004)", () => {
    const birth = "1946-06-15";
    expect(personPriority({ birthDate: birth }, [], at("2026-06-15T02:59:59Z"), TIME_ZONE)).toEqual(["elderly"]);
    expect(personPriority({ birthDate: birth }, [], at("2026-06-15T03:00:00Z"), TIME_ZONE)).toEqual(["elderly80"]);
  });

  it("RN-RISCO-04: declarada vale até a conferência (AD-024)", () => {
    expect(hasPriority(legal(["pregnant"], false))).toBe(true);
    expect(hasPriority(legal(["pregnant"], true, 1))).toBe(true);
    expect(hasPriority(legal([]))).toBe(false);
  });

  it("RN-RISCO-04: gestante, lactante e colo expiram; prazo a definir não expira (D5)", () => {
    // Prazos são null (D5 a definir): nunca expiram até a configuração existir.
    expect(expired(legal(["pregnant"], true, 0), 10 ** 13)).toBe(false);
    expect(expired(legal(["disability"], true, 0), 10 ** 13)).toBe(false);
    expect(expired(legal(["pregnant"], false, null), 10 ** 13)).toBe(false);
  });

  it("RN-RISCO-04: com prazo definido, expira no limite exato e não antes (L-004)", () => {
    const day = 86_400_000;
    const deadlines = { pregnant: 30 };
    expect(expired(legal(["pregnant"], true, 0), 30 * day - 1, deadlines)).toBe(false);
    expect(expired(legal(["pregnant"], true, 0), 30 * day, deadlines)).toBe(true);
  });

  it("AD-027: a entrada não é alterada", () => {
    const declared = Object.freeze(["pregnant"] as Group[]) as Group[];
    const person = Object.freeze({ birthDate: "1940-01-01" });
    const r = personPriority(person, declared, at("2026-06-15T15:00:00Z"), TIME_ZONE);
    expect(r).toEqual(["elderly80", "pregnant"]);
    expect(r).not.toBe(declared);
  });
});
