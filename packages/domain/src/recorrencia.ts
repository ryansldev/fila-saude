/**
 * Recorrência de sessões em hora local "flutuante" (RFC 5545, PD-26).
 *
 * A série guarda DTSTART, EXDATE e RDATE como hora local `AAAA-MM-DDTHH:mm`, sem fuso. O `rrule`
 * expande sem `tzid`, com a hora local tratada como UTC (só usa os getters UTC do `Date`, então
 * não depende do fuso da máquina); cada ocorrência vira instante real por `localParaInstante`.
 */
import * as modulo from "rrule";
import type { EstadoSessao } from "./contratos.ts";
import { instanteParaLocal, localComoUtc, localParaInstante, utcComoLocal } from "./tempo.ts";

// O rrule 2.8 publica CJS (`main`) e ESM (`module`) sem `exports`: o Node puro carrega o CJS, que só
// expõe `default`; o Vite/Vitest carrega o ESM, que só tem exports nomeados.
const { RRule } = "RRule" in modulo ? modulo : (modulo as unknown as { default: typeof modulo }).default;

export type Serie = {
  /** Início da primeira ocorrência, hora local `AAAA-MM-DDTHH:mm`. */
  dtstart: string;
  duracaoMin: number;
  /**
   * Regra RFC 5545 sem DTSTART, ex.: `"FREQ=WEEKLY;BYDAY=TU"`. Início, hora e fuso vêm dos outros
   * campos: `DTSTART`, `TZID`, `BYHOUR`, `BYMINUTE`, `BYSECOND`, frequências abaixo de diária e
   * `UNTIL` em UTC (`...Z`) são recusados com `rrule_invalida`. `UNTIL` é hora local: só a data
   * (`AAAAMMDD`) vale até o fim daquele dia; com hora (`AAAAMMDDTHHMMSS`), até aquela hora.
   */
  rrule: string;
  /** Ocorrências removidas, pela chave (hora local `AAAA-MM-DDTHH:mm`). */
  exdate: string[];
  /** Ocorrências avulsas acrescentadas (hora local); a igual a uma da regra aparece uma vez. */
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

/** Dias à frente que o worker materializa (T2.5). */
export const JANELA_MATERIALIZACAO_DIAS = 90;

/** Janela de materialização: `[agora, agora + 90 dias)`. */
export function janelaDeMaterializacao(agora: number): Janela {
  return { de: agora, ate: agora + JANELA_MATERIALIZACAO_DIAS * DIA };
}

const DIA_DA_SEMANA = "(?:MO|TU|WE|TH|FR|SA|SU)";
const LISTA_DE_NUMEROS = /^[+-]?\d{1,3}(?:,[+-]?\d{1,3})*$/;

/** Partes aceitas na `rrule` da série; qualquer outra (DTSTART, TZID, BYHOUR...) é recusada. */
const PARTES: Record<string, RegExp> = {
  FREQ: /^(?:DAILY|WEEKLY|MONTHLY|YEARLY)$/,
  INTERVAL: /^[1-9]\d*$/,
  COUNT: /^[1-9]\d*$/,
  UNTIL: /^\d{8}(?:T\d{6})?$/,
  BYDAY: new RegExp(`^[+-]?\\d{0,2}${DIA_DA_SEMANA}(?:,[+-]?\\d{0,2}${DIA_DA_SEMANA})*$`),
  BYMONTHDAY: LISTA_DE_NUMEROS,
  BYMONTH: LISTA_DE_NUMEROS,
  BYYEARDAY: LISTA_DE_NUMEROS,
  BYWEEKNO: LISTA_DE_NUMEROS,
  BYSETPOS: LISTA_DE_NUMEROS,
  WKST: new RegExp(`^${DIA_DA_SEMANA}$`),
};

function invalida(): never {
  throw new Error("rrule_invalida");
}

/** `UNTIL` em hora local flutuante (como UTC); só a data vale até 23:59:59 daquele dia. */
function untilLocal(valor: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?$/.exec(valor) ?? invalida();
  const [a, me, d, h = 23, mi = 59, se = 59] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  const t = Date.UTC(a ?? 0, (me ?? 1) - 1, d ?? 1, h, mi, se);
  const lido = new Date(t);
  const confere = [
    lido.getUTCFullYear(),
    lido.getUTCMonth() + 1,
    lido.getUTCDate(),
    lido.getUTCHours(),
    lido.getUTCMinutes(),
  ];
  if (confere.join() !== [a, me, d, h, mi].join() || se > 59) invalida();
  return t;
}

/** A regra da série, validada; `rrule` inválida ou fora do modelo flutuante lança `rrule_invalida`. */
function regraDaSerie(serie: Serie): InstanceType<typeof RRule> {
  const partes = new Map<string, string>();
  for (const parte of serie.rrule.split(";")) {
    const [chave = "", valor, ...resto] = parte.split("=");
    const formato = PARTES[chave];
    if (!formato || valor === undefined || resto.length > 0 || partes.has(chave) || !formato.test(valor)) invalida();
    partes.set(chave, valor);
  }
  if (!partes.has("FREQ") || (partes.has("COUNT") && partes.has("UNTIL"))) invalida();
  const until = partes.get("UNTIL");
  partes.delete("UNTIL");
  try {
    const opcoes = RRule.parseString([...partes].map(([c, v]) => `${c}=${v}`).join(";"));
    return new RRule({
      ...opcoes,
      dtstart: new Date(localComoUtc(serie.dtstart)),
      until: until === undefined ? null : new Date(untilLocal(until)),
    });
  } catch {
    return invalida();
  }
}

/**
 * Horas locais da série entre `de` e `ate` (flutuantes, inclusivas): as da regra mais as RDATE,
 * sem repetição, menos as EXDATE.
 */
function locaisDaSerie(serie: Serie, de: number, ate: number): string[] {
  const regra = regraDaSerie(serie);
  const locais = new Set(regra.between(new Date(de), new Date(ate), true).map((d) => utcComoLocal(d.getTime())));
  for (const local of serie.rdate) locais.add(local);
  for (const local of serie.exdate) locais.delete(local);
  return [...locais];
}

/** Ocorrências que começam em `[de, ate)`, ordenadas por início. */
export function expandir(serie: Serie, janela: Janela): Ocorrencia[] {
  // Janela em hora local flutuante, com 1 dia de folga nas pontas (saltos e horas repetidas);
  // o filtro final usa os instantes reais.
  const de = localComoUtc(instanteParaLocal(janela.de, serie.fuso)) - DIA;
  const ate = localComoUtc(instanteParaLocal(janela.ate, serie.fuso)) + DIA;
  return locaisDaSerie(serie, de, ate)
    .map((chave) => {
      const inicio = localParaInstante(chave, serie.fuso);
      return { chave, inicio, fim: inicio + serie.duracaoMin * MIN };
    })
    .filter((o) => o.inicio >= janela.de && o.inicio < janela.ate)
    .sort((a, b) => a.inicio - b.inicio);
}

/** Ocorrências da série em `janela` cuja chave ainda não foi materializada (idempotência, PD-26). */
export function ocorrenciasNovas(serie: Serie, existentes: Set<string>, janela: Janela): Ocorrencia[] {
  return expandir(serie, janela).filter((o) => !existentes.has(o.chave));
}

/** Data local (`AAAAMMDD`) do dia anterior à chave. */
function vesperaDe(chave: string): string {
  return utcComoLocal(localComoUtc(chave) - DIA)
    .slice(0, 10)
    .replaceAll("-", "");
}

/** `rrule` sem `COUNT` e `UNTIL`, mais o fim pedido. */
function trocarFim(rrule: string, fim: string): string {
  const resto = rrule.split(";").filter((p) => !p.startsWith("COUNT=") && !p.startsWith("UNTIL="));
  return [...resto, fim].join(";");
}

/**
 * "Esta e as seguintes" (PD-27): fecha a série em `antiga` na véspera de `aPartirDe` e abre `nova`
 * a partir dela. `COUNT` é repartido (as ocorrências removidas por EXDATE antes do corte contam,
 * como no RFC 5545); EXDATE e RDATE vão para o lado da sua data. Não altera `serie`.
 * `aPartirDe` que não é ocorrência da série lança `ocorrencia_inexistente`.
 */
export function dividirSerie(serie: Serie, aPartirDe: string): { antiga: Serie; nova: Serie } {
  const corte = localComoUtc(aPartirDe);
  if (!locaisDaSerie(serie, corte, corte).includes(aPartirDe)) throw new Error("ocorrencia_inexistente");
  const antes = (chave: string) => chave < aPartirDe; // chaves têm largura fixa: ordem de texto = cronológica
  const vespera = `UNTIL=${vesperaDe(aPartirDe)}`;
  const count = /(?:^|;)COUNT=(\d+)/.exec(serie.rrule)?.[1];
  let rruleNova = serie.rrule;
  if (count !== undefined) {
    const usadas = regraDaSerie(serie)
      .between(new Date(localComoUtc(serie.dtstart)), new Date(corte), true)
      .filter((d) => d.getTime() < corte).length;
    const restantes = Number(count) - usadas;
    // RDATE avulsa além do fim da regra: a regra da nova fica vazia e só a RDATE resta.
    rruleNova = trocarFim(serie.rrule, restantes > 0 ? `COUNT=${restantes}` : vespera);
  }
  return {
    antiga: {
      ...serie,
      rrule: trocarFim(serie.rrule, vespera),
      exdate: serie.exdate.filter(antes),
      rdate: serie.rdate.filter(antes),
    },
    nova: {
      ...serie,
      dtstart: aPartirDe,
      rrule: rruleNova,
      exdate: serie.exdate.filter((c) => !antes(c)),
      rdate: serie.rdate.filter((c) => !antes(c)),
    },
  };
}

/**
 * Das sessões já materializadas da série antiga, decide o que a divisão apaga (PD-27): só as
 * `planejada` sem entradas a partir de `aPartirDe` (inclusive). O resto é mantido.
 */
export function separarMaterializadas(
  chaves: { chave: string; temEntradas: boolean; estado: EstadoSessao }[],
  aPartirDe: string,
): { apagar: string[]; manter: string[] } {
  const apagar: string[] = [];
  const manter: string[] = [];
  for (const c of chaves) {
    const apagavel = c.chave >= aPartirDe && c.estado === "planejada" && !c.temEntradas;
    (apagavel ? apagar : manter).push(c.chave);
  }
  return { apagar, manter };
}
