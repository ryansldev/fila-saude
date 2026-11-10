import { describe, expect, it } from "vitest";
import { type ChaveOrdem, type ChaveSugestao, compararOrdem, compararSugestao } from "../src/ordem.ts";
import type { PrioridadeLegal } from "../src/prioridade.ts";

const SEM: PrioridadeLegal = { grupos: [], conferida: false, conferidaEm: null };
const com = (...grupos: PrioridadeLegal["grupos"]): PrioridadeLegal => ({
  grupos,
  conferida: false,
  conferidaEm: null,
});

const chave = (p: Partial<ChaveOrdem> = {}): ChaveOrdem => ({
  urgenciaConfirmada: false,
  risco: "rotina",
  prioridade: SEM,
  numero: 1,
  ...p,
});
const sug = (p: Partial<ChaveSugestao> = {}): ChaveSugestao => ({
  urgenciaConfirmada: false,
  remanejada: false,
  risco: "rotina",
  prioridade: SEM,
  dataEntradaOriginal: 1,
  id: "a",
  ...p,
});

function ordenar<T>(xs: T[], cmp: (a: T, b: T) => number): T[] {
  return [...xs].sort(cmp);
}

describe("compararOrdem", () => {
  it("RN-ORD: urgência confirmada sempre primeiro", () => {
    const urg = chave({ urgenciaConfirmada: true, risco: "rotina", numero: 9 });
    const alto = chave({ risco: "urgente", prioridade: com("idoso80"), numero: 1 });
    for (const modo of ["risco", "prioridade"] as const) {
      expect(compararOrdem(urg, alto, modo)).toBeLessThan(0);
      expect(compararOrdem(alto, urg, modo)).toBeGreaterThan(0);
    }
  });

  it("RN-ORD: risco antes (padrão), depois prioridade legal, depois número", () => {
    const atencao = chave({ risco: "atencao", numero: 5 });
    const idosa = chave({ prioridade: com("idoso"), numero: 3 });
    expect(compararOrdem(atencao, idosa, "risco")).toBeLessThan(0);
    const urgente = chave({ risco: "urgente", numero: 9 });
    expect(compararOrdem(urgente, atencao, "risco")).toBeLessThan(0);
  });

  it("RN-ORD / AD-004: municipal rule switches legal before risk", () => {
    const atencao = chave({ risco: "atencao", numero: 5 });
    const idosa = chave({ prioridade: com("idoso"), numero: 3 });
    expect(compararOrdem(atencao, idosa, "prioridade")).toBeGreaterThan(0);
    expect(compararOrdem(idosa, atencao, "prioridade")).toBeLessThan(0);
    // dentro da mesma prioridade, o risco decide
    const a = chave({ prioridade: com("gestante"), risco: "urgente", numero: 8 });
    const b = chave({ prioridade: com("pcd"), risco: "rotina", numero: 1 });
    expect(compararOrdem(a, b, "prioridade")).toBeLessThan(0);
  });

  it("RN-ORD: 80+ antes de 60-79; grupos diferentes empatam e decide o número", () => {
    const i80 = chave({ prioridade: com("idoso80"), numero: 9 });
    const i60 = chave({ prioridade: com("idoso"), numero: 1 });
    expect(compararOrdem(i80, i60, "risco")).toBeLessThan(0);
    const gest = chave({ prioridade: com("gestante"), numero: 2 });
    const pcd = chave({ prioridade: com("pcd"), numero: 1 });
    expect(compararOrdem(gest, pcd, "risco")).toBeGreaterThan(0);
    expect(compararOrdem(pcd, gest, "risco")).toBeLessThan(0);
  });

  it("RN-ORD: empate de risco e prioridade resolve pelo número, o menor primeiro", () => {
    const a = chave({ numero: 7 });
    const b = chave({ numero: 3 });
    expect(compararOrdem(a, b, "risco")).toBeGreaterThan(0);
    expect(compararOrdem(b, a, "prioridade")).toBeLessThan(0);
    expect(compararOrdem(a, a, "risco")).toBe(0);
  });

  it("RN-ORD: ordem total determinística independe da ordem de entrada", () => {
    const itens = [
      chave({ numero: 4, risco: "atencao" }),
      chave({ numero: 2 }),
      chave({ numero: 3, prioridade: com("tea") }),
      chave({ numero: 1, urgenciaConfirmada: true }),
      chave({ numero: 5, risco: "urgente" }),
    ];
    const esperado = ordenar(itens, (a, b) => compararOrdem(a, b, "risco")).map((c) => c.numero);
    expect(esperado).toEqual([1, 5, 4, 3, 2]);
    const invertido = ordenar([...itens].reverse(), (a, b) => compararOrdem(a, b, "risco"));
    expect(invertido.map((c) => c.numero)).toEqual(esperado);
  });
});

describe("compararSugestao", () => {
  it("RN-AL-02: urgência, remanejados, depois risco e prioridade, depois data", () => {
    const urgente = sug({ id: "u", urgenciaConfirmada: true, dataEntradaOriginal: 1 });
    const reman = sug({ id: "r", remanejada: true, dataEntradaOriginal: 2 });
    const atencao = sug({ id: "at", risco: "atencao", dataEntradaOriginal: 5 });
    const idosa = sug({ id: "i", prioridade: com("idoso"), dataEntradaOriginal: 3 });
    const rotina = sug({ id: "ro", dataEntradaOriginal: 50 });
    const ids = (modo: "risco" | "prioridade") =>
      ordenar([rotina, idosa, atencao, reman, urgente], (a, b) => compararSugestao(a, b, modo)).map((s) => s.id);
    expect(ids("risco")).toEqual(["u", "r", "at", "i", "ro"]);
    expect(ids("prioridade")).toEqual(["u", "r", "i", "at", "ro"]);
  });

  it("RN-AL-02: urgência vence remanejada de risco maior", () => {
    const urg = sug({ id: "u", urgenciaConfirmada: true, risco: "rotina" });
    const rem = sug({ id: "r", remanejada: true, risco: "urgente" });
    expect(compararSugestao(urg, rem, "risco")).toBeLessThan(0);
  });

  it("RN-AL-02: remanejada vence risco e prioridade", () => {
    const rem = sug({ id: "r", remanejada: true });
    const alto = sug({ id: "x", risco: "urgente", prioridade: com("idoso80") });
    expect(compararSugestao(rem, alto, "risco")).toBeLessThan(0);
    expect(compararSugestao(rem, alto, "prioridade")).toBeLessThan(0);
  });

  it("RN-AL-02: empate resolve pela data de entrada original e depois pelo id", () => {
    const antiga = sug({ id: "z", dataEntradaOriginal: 10 });
    const nova = sug({ id: "a", dataEntradaOriginal: 20 });
    expect(compararSugestao(antiga, nova, "risco")).toBeLessThan(0);
    const x = sug({ id: "a", dataEntradaOriginal: 10 });
    const y = sug({ id: "b", dataEntradaOriginal: 10 });
    expect(compararSugestao(x, y, "risco")).toBeLessThan(0);
    expect(compararSugestao(y, x, "prioridade")).toBeGreaterThan(0);
    expect(compararSugestao(x, x, "risco")).toBe(0);
  });
});
