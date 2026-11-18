/**
 * Recorrência de sessões em hora local "flutuante" (RFC 5545, PD-26).
 *
 * A série guarda DTSTART, EXDATE e RDATE como hora local `AAAA-MM-DDTHH:mm`, sem fuso. O `rrule`
 * expande sem `tzid`, com a hora local tratada como UTC (só usa os getters UTC do `Date`, então
 * não depende do fuso da máquina); cada ocorrência vira instante real por `localParaInstante`.
 */
import * as modulo from "rrule";
import type { SessionState } from "./contracts.ts";
import { instantToLocal, localAsUtc, localToInstant, utcAsLocal } from "./time.ts";

// O rrule 2.8 publica CJS (`main`) e ESM (`module`) sem `exports`: o Node puro carrega o CJS, que só
// expõe `default`; o Vite/Vitest carrega o ESM, que só tem exports nomeados.
const { RRule } = "RRule" in modulo ? modulo : (modulo as unknown as { default: typeof modulo }).default;

export type Series = {
  /** Início da primeira ocorrência, hora local `AAAA-MM-DDTHH:mm`. */
  dtstart: string;
  durationMin: number;
  /**
   * Regra RFC 5545 sem DTSTART, ex.: `"FREQ=WEEKLY;BYDAY=TU"`. Início, hora e fuso vêm dos outros
   * campos: `DTSTART`, `TZID`, `BYHOUR`, `BYMINUTE`, `BYSECOND`, frequências abaixo de diária e
   * `UNTIL` em UTC (`...Z`) são recusados com `invalid_rrule`. `UNTIL` é hora local: só a data
   * (`YYYYMMDD`) vale até o fim daquele dia; com hora (`YYYYMMDDTHHMMSS`), até aquela hora.
   */
  rrule: string;
  /** Ocorrências removidas, pela chave (hora local `AAAA-MM-DDTHH:mm`). */
  exdate: string[];
  /** Ocorrências avulsas acrescentadas (hora local); a igual a uma da regra aparece uma vez. */
  rdate: string[];
  /** Fuso IANA da unidade. */
  timeZone: string;
};

export type Occurrence = {
  /** Início local original (equivale ao RECURRENCE-ID); única dentro da série. */
  key: string;
  start: number;
  end: number;
};

export type Window = { de: number; until: number };

const MIN = 60_000;
const DAY = 86_400_000;

/** Dias à frente que o worker materializa (T2.5). */
export const MATERIALIZATION_WINDOW_DAYS = 90;

/** Janela de materialização: `[agora, agora + 90 dias)`. */
export function materializationWindow(now: number): Window {
  return { de: now, until: now + MATERIALIZATION_WINDOW_DAYS * DAY };
}

const WEEK_DAY = "(?:MO|TU|WE|TH|FR|SA|SU)";
const NUMBER_LIST = /^[+-]?\d{1,3}(?:,[+-]?\d{1,3})*$/;

/** Partes aceitas na `rrule` da série; qualquer outra (DTSTART, TZID, BYHOUR...) é recusada. */
const PARTS: Record<string, RegExp> = {
  FREQ: /^(?:DAILY|WEEKLY|MONTHLY|YEARLY)$/,
  INTERVAL: /^[1-9]\d*$/,
  COUNT: /^[1-9]\d*$/,
  UNTIL: /^\d{8}(?:T\d{6})?$/,
  BYDAY: new RegExp(`^[+-]?\\d{0,2}${WEEK_DAY}(?:,[+-]?\\d{0,2}${WEEK_DAY})*$`),
  BYMONTHDAY: NUMBER_LIST,
  BYMONTH: NUMBER_LIST,
  BYYEARDAY: NUMBER_LIST,
  BYWEEKNO: NUMBER_LIST,
  BYSETPOS: NUMBER_LIST,
  WKST: new RegExp(`^${WEEK_DAY}$`),
};

function invalid(): never {
  throw new Error("invalid_rrule");
}

/** `UNTIL` em hora local flutuante (como UTC); só a data vale até 23:59:59 daquele dia. */
function untilLocal(value: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?$/.exec(value) ?? invalid();
  const [a, me, d, h = 23, mi = 59, when = 59] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  const t = Date.UTC(a ?? 0, (me ?? 1) - 1, d ?? 1, h, mi, when);
  const read = new Date(t);
  const matches = [
    read.getUTCFullYear(),
    read.getUTCMonth() + 1,
    read.getUTCDate(),
    read.getUTCHours(),
    read.getUTCMinutes(),
  ];
  if (matches.join() !== [a, me, d, h, mi].join() || when > 59) invalid();
  return t;
}

/** A regra da série, validada; `rrule` inválida ou fora do modelo flutuante lança `invalid_rrule`. */
function seriesRule(series: Series): InstanceType<typeof RRule> {
  const parts = new Map<string, string>();
  for (const part of series.rrule.split(";")) {
    const [key = "", value, ...rest] = part.split("=");
    const format = PARTS[key];
    if (!format || value === undefined || rest.length > 0 || parts.has(key) || !format.test(value)) invalid();
    parts.set(key, value);
  }
  if (!parts.has("FREQ") || (parts.has("COUNT") && parts.has("UNTIL"))) invalid();
  const until = parts.get("UNTIL");
  parts.delete("UNTIL");
  try {
    const options = RRule.parseString([...parts].map(([c, v]) => `${c}=${v}`).join(";"));
    return new RRule({
      ...options,
      dtstart: new Date(localAsUtc(series.dtstart)),
      until: until === undefined ? null : new Date(untilLocal(until)),
    });
  } catch {
    return invalid();
  }
}

/**
 * Horas locais da série entre `de` e `ate` (flutuantes, inclusivas): as da regra mais as RDATE,
 * sem repetição, menos as EXDATE.
 */
function seriesLocal(series: Series, de: number, until: number): string[] {
  const rule = seriesRule(series);
  const locals = new Set(rule.between(new Date(de), new Date(until), true).map((d) => utcAsLocal(d.getTime())));
  for (const local of series.rdate) locals.add(local);
  for (const local of series.exdate) locals.delete(local);
  return [...locals];
}

/** Ocorrências que começam em `[de, ate)`, ordenadas por início. */
export function expand(series: Series, window: Window): Occurrence[] {
  // Janela em hora local flutuante, com 1 dia de folga nas pontas (saltos e horas repetidas);
  // o filtro final usa os instantes reais.
  const de = localAsUtc(instantToLocal(window.de, series.timeZone)) - DAY;
  const until = localAsUtc(instantToLocal(window.until, series.timeZone)) + DAY;
  return seriesLocal(series, de, until)
    .map((key) => {
      const start = localToInstant(key, series.timeZone);
      return { key, start, end: start + series.durationMin * MIN };
    })
    .filter((o) => o.start >= window.de && o.start < window.until)
    .sort((a, b) => a.start - b.start);
}

/** Ocorrências da série em `janela` cuja chave ainda não foi materializada (idempotência, PD-26). */
export function newOccurrences(series: Series, existing: Set<string>, window: Window): Occurrence[] {
  return expand(series, window).filter((o) => !existing.has(o.key));
}

/** Data local (`YYYYMMDD`) do dia anterior à chave. */
function eveOf(key: string): string {
  return utcAsLocal(localAsUtc(key) - DAY)
    .slice(0, 10)
    .replaceAll("-", "");
}

/** `rrule` sem `COUNT` e `UNTIL`, mais o fim pedido. */
function switchEnd(rrule: string, end: string): string {
  const rest = rrule.split(";").filter((p) => !p.startsWith("COUNT=") && !p.startsWith("UNTIL="));
  return [...rest, end].join(";");
}

/**
 * "Esta e as seguintes" (PD-27): `antiga` termina antes de `startingFrom` e `nova` segue dali. Não
 * altera `series`; `startingFrom` que não é ocorrência da série lança `occurrence_not_found`.
 *
 * - A regra continua sendo a mesma: `nova.dtstart` é a primeira ocorrência da *regra* a partir do
 *   corte (mantém hora, dia e fase de `INTERVAL`), mesmo quando o corte é uma RDATE. Sem ocorrência
 *   da regra a partir do corte, a regra da `nova` fica vazia e só as RDATE restam.
 * - `COUNT` é repartido (as removidas por EXDATE antes do corte contam, como no RFC 5545).
 * - `antiga` só ganha `UNTIL` quando a regra ainda tem ocorrência a partir do corte: na véspera
 *   (só data) se o corte é da regra; na última ocorrência da regra antes do corte, se é RDATE.
 * - EXDATE e RDATE vão para o lado da sua chave (a do corte, para a `nova`).
 */
export function splitSeries(series: Series, startingFrom: string): { old: Series; new: Series } {
  const cut = localAsUtc(startingFrom);
  if (!seriesLocal(series, cut, cut).includes(startingFrom)) throw new Error("occurrence_not_found");
  const before = (key: string) => key < startingFrom; // chaves têm largura fixa: ordem de texto = cronológica
  const rule = seriesRule(series);
  const next = rule.after(new Date(cut), true);
  const previous = rule.before(new Date(cut), false);
  const eve = `UNTIL=${eveOf(startingFrom)}`;
  const count = /(?:^|;)COUNT=(\d+)/.exec(series.rrule)?.[1];

  let rruleOld = series.rrule;
  let rruleNew = switchEnd(series.rrule, eve);
  let dtstartNew = startingFrom;
  if (next) {
    dtstartNew = utcAsLocal(next.getTime());
    const atCutoff = dtstartNew === startingFrom;
    const until =
      previous && !atCutoff
        ? `UNTIL=${utcAsLocal(previous.getTime())
            .replace(/\D/g, "")
            .replace(/^(\d{8})/, "$1T")}00`
        : eve;
    rruleOld = switchEnd(series.rrule, until);
    rruleNew = series.rrule;
    if (count !== undefined) {
      const used = rule
        .between(new Date(localAsUtc(series.dtstart)), new Date(cut), true)
        .filter((d) => d.getTime() < cut).length;
      rruleNew = switchEnd(series.rrule, `COUNT=${Number(count) - used}`);
    }
  }
  return {
    old: { ...series, rrule: rruleOld, exdate: series.exdate.filter(before), rdate: series.rdate.filter(before) },
    new: {
      ...series,
      dtstart: dtstartNew,
      rrule: rruleNew,
      exdate: series.exdate.filter((c) => !before(c)),
      rdate: series.rdate.filter((c) => !before(c)),
    },
  };
}

/**
 * Das sessões já materializadas da série antiga, decide o que a divisão apaga (PD-27): só as
 * `planejada` sem entradas a partir de `startingFrom` (inclusive). O resto é mantido.
 */
export function separateMaterialized(
  keys: { key: string; hasEntries: boolean; state: SessionState }[],
  startingFrom: string,
): { erase: string[]; keep: string[] } {
  const erase: string[] = [];
  const keep: string[] = [];
  for (const c of keys) {
    const erasable = c.key >= startingFrom && c.state === "planned" && !c.hasEntries;
    (erasable ? erase : keep).push(c.key);
  }
  return { erase, keep };
}
