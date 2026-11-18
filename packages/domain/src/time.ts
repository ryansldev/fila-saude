/** Dias e horas no fuso da unidade (IANA). Tempo é sempre epoch ms em UTC. */

type DataLocal = { year: number; month: number; day: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Relógio local de `instante` no fuso, expresso como se fosse UTC. */
function localClockAsUtc(instant: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
}

function dataLocal(instant: number, timeZone: string): DataLocal {
  const d = new Date(localClockAsUtc(instant, timeZone));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const DAY = 86_400_000;

/**
 * Instante em que o relógio local do fuso marca `alvo` (relógio local expresso como se fosse UTC).
 * Hora que não existe (salto do horário de verão) avança pelo tamanho do salto; hora repetida
 * (volta do horário de verão) fica com o primeiro instante — como o `compatible` do Temporal.
 */
function clockInstant(target: number, timeZone: string): number {
  const offset = (t: number) => localClockAsUtc(t, timeZone) - Math.floor(t / 1000) * 1000;
  const before = target - offset(target - DAY);
  const after = target - offset(target + DAY);
  const valid = [before, after].filter((t) => localClockAsUtc(t, timeZone) === target);
  // Nenhum válido: hora pulada; com o deslocamento de antes do salto, cai depois dele.
  return valid.length > 0 ? Math.min(...valid) : before;
}

/** Epoch ms de 00:00 da data local no fuso. */
function midnight({ year, month, day }: DataLocal, timeZone: string): number {
  return clockInstant(Date.UTC(year, month - 1, day), timeZone);
}

const LOCAL_FORMAT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Hora local "flutuante" `AAAA-MM-DDTHH:mm` lida como se fosse UTC (sem fuso). */
export function localAsUtc(local: string): number {
  const m = LOCAL_FORMAT.exec(local);
  if (!m) throw new Error(`hora local fora do formato AAAA-MM-DDTHH:mm: ${local}`);
  const [, a, me, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const t = Date.UTC(a, me - 1, d, h, mi);
  if (utcAsLocal(t) !== local) throw new Error(`hora local inexistente no calendário: ${local}`);
  return t;
}

/** Inverso de `localAsUtc`: `AAAA-MM-DDTHH:mm` (segundos descartados). */
export function utcAsLocal(t: number): string {
  return new Date(t).toISOString().slice(0, 16);
}

/** Instante (epoch ms) da hora local `AAAA-MM-DDTHH:mm` no fuso. */
export function localToInstant(local: string, timeZone: string): number {
  return clockInstant(localAsUtc(local), timeZone);
}

/** Hora local `AAAA-MM-DDTHH:mm` do instante no fuso. */
export function instantToLocal(instant: number, timeZone: string): string {
  return utcAsLocal(localClockAsUtc(instant, timeZone));
}

/** Idade em anos completos no dia local de `agora`; o aniversário vale desde 00:00 do dia. */
export function ageAt(birthDate: string, now: number, timeZone: string): number {
  const [a = 0, m = 0, d = 0] = birthDate.split("-").map(Number);
  const today = dataLocal(now, timeZone);
  let age = today.year - a;
  // Nascido em 29/02 faz anos em 01/03 nos anos comuns: a comparação (mês, dia) já resolve.
  if (today.month < m || (today.month === m && today.day < d)) age -= 1;
  return age;
}

export function sameDay(a: number, b: number, timeZone: string): boolean {
  const da = dataLocal(a, timeZone);
  const db = dataLocal(b, timeZone);
  return da.year === db.year && da.month === db.month && da.day === db.day;
}

/** 00:00 do dia anterior ao dia da sessão, no fuso da unidade. */
export function eve(startSession: number, timeZone: string): number {
  const { year, month, day } = dataLocal(startSession, timeZone);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return midnight(
    {
      year: previous.getUTCFullYear(),
      month: previous.getUTCMonth() + 1,
      day: previous.getUTCDate(),
    },
    timeZone,
  );
}
