import { describe, expect, it } from "vitest";
import {
  expirada,
  GRUPOS,
  type Grupo,
  grupoDeDeclarado,
  type PrioridadeLegal,
  prioridadeDaPessoa,
  rankPrioridade,
  temPrioridade,
} from "../src/prioridade.ts";

const FUSO = "America/Sao_Paulo";
const em = (iso: string) => Date.parse(iso);
const legal = (grupos: Grupo[], conferida = false, conferidaEm: number | null = null): PrioridadeLegal => ({
  grupos,
  conferida,
  conferidaEm,
});

describe("prioridade legal (RN-RISCO-04)", () => {
  it("RN-RISCO-04: idoso vem da data de nascimento, 80+ acima dos demais", () => {
    const agora = em("2026-06-15T15:00:00Z");
    expect(prioridadeDaPessoa({ nascimento: "1950-01-01" }, [], agora, FUSO)).toEqual(["idoso"]);
    expect(prioridadeDaPessoa({ nascimento: "1940-01-01" }, [], agora, FUSO)).toEqual(["idoso80"]);
    expect(prioridadeDaPessoa({ nascimento: "1990-01-01" }, [], agora, FUSO)).toEqual([]);
    expect(rankPrioridade(legal(["idoso80"]))).toBe(2);
    expect(rankPrioridade(legal(["idoso"]))).toBe(1);
    expect(rankPrioridade(legal(["idoso", "idoso80"]))).toBe(2);
    expect(rankPrioridade(legal([]))).toBe(0);
  });

  it("RN-RISCO-04: idoso não pode ser declarado, só vem da idade", () => {
    const agora = em("2026-06-15T15:00:00Z");
    expect(prioridadeDaPessoa({ nascimento: "1990-01-01" }, ["idoso", "idoso80"], agora, FUSO)).toEqual([]);
  });

  it("RN-RISCO-04: entre grupos diferentes não há hierarquia", () => {
    expect(rankPrioridade(legal(["gestante"]))).toBe(1);
    expect(rankPrioridade(legal(["pcd"]))).toBe(1);
    expect(rankPrioridade(legal(["gestante"]))).toBe(rankPrioridade(legal(["pcd"])));
    expect(rankPrioridade(legal(["gestante", "pcd", "tea"]))).toBe(1);
  });

  it("AD-027: prioridade do acompanhante não passa ao atendido", () => {
    const agora = em("2026-06-15T15:00:00Z");
    // O acompanhante (idoso, gestante) não entra: só a pessoa atendida e o que ela declara.
    expect(prioridadeDaPessoa({ nascimento: "2000-01-01" }, [], agora, FUSO)).toEqual([]);
  });

  it("AD-027: criança de colo atendida mantém colo", () => {
    const agora = em("2026-06-15T15:00:00Z");
    expect(prioridadeDaPessoa({ nascimento: "2025-09-01" }, ["colo"], agora, FUSO)).toEqual(["colo"]);
  });

  it("AD-025: mobilidade reduzida e doador de sangue estão na lista", () => {
    expect(Object.keys(GRUPOS)).toEqual(
      expect.arrayContaining(["mobilidade", "doador", "obesidade", "lactante", "tea", "pcd", "colo", "gestante"]),
    );
    expect(GRUPOS.mobilidade.conferencia).toBe("a_definir");
    expect(GRUPOS.doador.conferencia).toBe("a_definir");
    expect(GRUPOS.idoso).toEqual({ conferencia: "nascimento", expiraEmDias: null });
    expect(GRUPOS.idoso80).toEqual({ conferencia: "nascimento", expiraEmDias: null });
    expect(GRUPOS.gestante.conferencia).toBe("visual");
    expect(GRUPOS.colo.conferencia).toBe("visual");
    expect(GRUPOS.pcd.conferencia).toBe("documento");
    expect(GRUPOS.tea.conferencia).toBe("documento");
    expect(grupoDeDeclarado("mobilidade_reduzida")).toBe("mobilidade");
    expect(grupoDeDeclarado("doador_de_sangue")).toBe("doador");
    expect(grupoDeDeclarado("crianca_de_colo")).toBe("colo");
    expect(grupoDeDeclarado("gestante")).toBe("gestante");
  });

  it("RN-RISCO-04: 59 anos não é idoso, 60 no dia do aniversário é (L-004)", () => {
    const nasc = "1966-06-15";
    // Antes das 00:00 de 15/06 em São Paulo (03:00Z): ainda 59.
    expect(prioridadeDaPessoa({ nascimento: nasc }, [], em("2026-06-15T02:59:59Z"), FUSO)).toEqual([]);
    expect(prioridadeDaPessoa({ nascimento: nasc }, [], em("2026-06-15T03:00:00Z"), FUSO)).toEqual(["idoso"]);
  });

  it("RN-RISCO-04: 79 anos é idoso, 80 no dia do aniversário é idoso80 (L-004)", () => {
    const nasc = "1946-06-15";
    expect(prioridadeDaPessoa({ nascimento: nasc }, [], em("2026-06-15T02:59:59Z"), FUSO)).toEqual(["idoso"]);
    expect(prioridadeDaPessoa({ nascimento: nasc }, [], em("2026-06-15T03:00:00Z"), FUSO)).toEqual(["idoso80"]);
  });

  it("RN-RISCO-04: declarada vale até a conferência (AD-024)", () => {
    expect(temPrioridade(legal(["gestante"], false))).toBe(true);
    expect(temPrioridade(legal(["gestante"], true, 1))).toBe(true);
    expect(temPrioridade(legal([]))).toBe(false);
  });

  it("RN-RISCO-04: gestante, lactante e colo expiram; prazo a definir não expira (D5)", () => {
    // Prazos são null (D5 a definir): nunca expiram até a configuração existir.
    expect(expirada(legal(["gestante"], true, 0), 10 ** 13)).toBe(false);
    expect(expirada(legal(["pcd"], true, 0), 10 ** 13)).toBe(false);
    expect(expirada(legal(["gestante"], false, null), 10 ** 13)).toBe(false);
  });

  it("RN-RISCO-04: com prazo definido, expira no limite exato e não antes (L-004)", () => {
    const dia = 86_400_000;
    const prazos = { gestante: 30 };
    expect(expirada(legal(["gestante"], true, 0), 30 * dia - 1, prazos)).toBe(false);
    expect(expirada(legal(["gestante"], true, 0), 30 * dia, prazos)).toBe(true);
  });

  it("AD-027: a entrada não é alterada", () => {
    const declarados = Object.freeze(["gestante"] as Grupo[]) as Grupo[];
    const pessoa = Object.freeze({ nascimento: "1940-01-01" });
    const r = prioridadeDaPessoa(pessoa, declarados, em("2026-06-15T15:00:00Z"), FUSO);
    expect(r).toEqual(["idoso80", "gestante"]);
    expect(r).not.toBe(declarados);
  });
});
