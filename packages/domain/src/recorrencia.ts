/**
 * Recorrência de sessões em hora local "flutuante" (RFC 5545, PD-26).
 *
 * A série guarda DTSTART, EXDATE e RDATE como hora local `AAAA-MM-DDTHH:mm`, sem fuso. O `rrule`
 * expande sem `tzid`, com a hora local tratada como UTC (só usa os getters UTC do `Date`, então
 * não depende do fuso da máquina); cada ocorrência vira instante real por `localParaInstante`.
 */
import * as modulo from "rrule";
import { instanteParaLocal, localComoUtc, localParaInstante, utcComoLocal } from "./tempo.ts";

// O rrule 2.8 publica CJS (`main`) e ESM (`module`) sem `exports`: o Node puro carrega o CJS, que só
// expõe `default`; o Vite/Vitest carrega o ESM, que só tem exports nomeados.
const { RRule } = "RRule" in modulo ? modulo : (modulo as unknown as { default: typeof modulo }).default;

export type Serie = {
  /** Início da primeira ocorrência, hora local `AAAA-MM-DDTHH:mm`. */
  dtstart: string;
  duracaoMin: number;
  /** Regra sem DTSTART, ex.: `"FREQ=WEEKLY;BYDAY=TU"`. */
  rrule: string;
  exdate: string[];
  rdate: string[];
  /** Fuso IANA da unidade. */
  fuso: string;
};

export type Ocorrencia = {
  /** Início local original (equivale ao RECURRENCE-ID); única dentro da série. */
  chave: string;
  inicio: number;
  fim: number;
};

export type Janela = { de: number; ate: number };

const MIN = 60_000;
const DIA = 86_400_000;

/** Horas locais geradas pela regra entre `de` e `ate` (flutuantes, inclusivas). */
function locaisDaRegra(serie: Serie, de: number, ate: number): string[] {
  const regra = new RRule({ ...RRule.parseString(serie.rrule), dtstart: new Date(localComoUtc(serie.dtstart)) });
  return regra.between(new Date(de), new Date(ate), true).map((d) => utcComoLocal(d.getTime()));
}

/** Ocorrências que começam em `[de, ate)`, ordenadas por início. */
export function expandir(serie: Serie, janela: Janela): Ocorrencia[] {
  // Janela em hora local flutuante, com 1 dia de folga nas pontas (saltos e horas repetidas);
  // o filtro final usa os instantes reais.
  const de = localComoUtc(instanteParaLocal(janela.de, serie.fuso)) - DIA;
  const ate = localComoUtc(instanteParaLocal(janela.ate, serie.fuso)) + DIA;
  return locaisDaRegra(serie, de, ate)
    .map((chave) => {
      const inicio = localParaInstante(chave, serie.fuso);
      return { chave, inicio, fim: inicio + serie.duracaoMin * MIN };
    })
    .filter((o) => o.inicio >= janela.de && o.inicio < janela.ate)
    .sort((a, b) => a.inicio - b.inicio);
}
