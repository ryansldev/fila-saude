/** Dias e horas no fuso da unidade (IANA). Tempo é sempre epoch ms em UTC. */

type DataLocal = { ano: number; mes: number; dia: number };

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

/** Relógio local de `instante` no fuso, expresso como se fosse UTC. */
function relogioLocalComoUtc(instante: number, fuso: string): number {
  const partes: Record<string, number> = {};
  for (const p of formatador(fuso).formatToParts(instante)) {
    if (p.type !== "literal") partes[p.type] = Number(p.value);
  }
  return Date.UTC(
    partes.year ?? 0,
    (partes.month ?? 1) - 1,
    partes.day ?? 1,
    partes.hour ?? 0,
    partes.minute ?? 0,
    partes.second ?? 0,
  );
}

function dataLocal(instante: number, fuso: string): DataLocal {
  const d = new Date(relogioLocalComoUtc(instante, fuso));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

const DIA = 86_400_000;

/**
 * Instante em que o relógio local do fuso marca `alvo` (relógio local expresso como se fosse UTC).
 * Hora que não existe (salto do horário de verão) avança pelo tamanho do salto; hora repetida
 * (volta do horário de verão) fica com o primeiro instante — como o `compatible` do Temporal.
 */
function instanteDoRelogio(alvo: number, fuso: string): number {
  const deslocamento = (t: number) => relogioLocalComoUtc(t, fuso) - Math.floor(t / 1000) * 1000;
  const antes = alvo - deslocamento(alvo - DIA);
  const depois = alvo - deslocamento(alvo + DIA);
  const validos = [antes, depois].filter((t) => relogioLocalComoUtc(t, fuso) === alvo);
  // Nenhum válido: hora pulada; com o deslocamento de antes do salto, cai depois dele.
  return validos.length > 0 ? Math.min(...validos) : antes;
}

/** Epoch ms de 00:00 da data local no fuso. */
function meiaNoite({ ano, mes, dia }: DataLocal, fuso: string): number {
  return instanteDoRelogio(Date.UTC(ano, mes - 1, dia), fuso);
}

const FORMATO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Hora local "flutuante" `AAAA-MM-DDTHH:mm` lida como se fosse UTC (sem fuso). */
export function localComoUtc(local: string): number {
  const m = FORMATO_LOCAL.exec(local);
  if (!m) throw new Error(`hora local fora do formato AAAA-MM-DDTHH:mm: ${local}`);
  const [, a, me, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const t = Date.UTC(a, me - 1, d, h, mi);
  if (utcComoLocal(t) !== local) throw new Error(`hora local inexistente no calendário: ${local}`);
  return t;
}

/** Inverso de `localComoUtc`: `AAAA-MM-DDTHH:mm` (segundos descartados). */
export function utcComoLocal(t: number): string {
  return new Date(t).toISOString().slice(0, 16);
}

/** Instante (epoch ms) da hora local `AAAA-MM-DDTHH:mm` no fuso. */
export function localParaInstante(local: string, fuso: string): number {
  return instanteDoRelogio(localComoUtc(local), fuso);
}

/** Hora local `AAAA-MM-DDTHH:mm` do instante no fuso. */
export function instanteParaLocal(instante: number, fuso: string): string {
  return utcComoLocal(relogioLocalComoUtc(instante, fuso));
}

/** Idade em anos completos no dia local de `agora`; o aniversário vale desde 00:00 do dia. */
export function idadeEm(nascimento: string, agora: number, fuso: string): number {
  const [a = 0, m = 0, d = 0] = nascimento.split("-").map(Number);
  const hoje = dataLocal(agora, fuso);
  let idade = hoje.ano - a;
  // Nascido em 29/02 faz anos em 01/03 nos anos comuns: a comparação (mês, dia) já resolve.
  if (hoje.mes < m || (hoje.mes === m && hoje.dia < d)) idade -= 1;
  return idade;
}

export function mesmoDia(a: number, b: number, fuso: string): boolean {
  const da = dataLocal(a, fuso);
  const db = dataLocal(b, fuso);
  return da.ano === db.ano && da.mes === db.mes && da.dia === db.dia;
}

/** 00:00 do dia anterior ao dia da sessão, no fuso da unidade. */
export function vespera(sessaoInicio: number, fuso: string): number {
  const { ano, mes, dia } = dataLocal(sessaoInicio, fuso);
  const anterior = new Date(Date.UTC(ano, mes - 1, dia - 1));
  return meiaNoite(
    {
      ano: anterior.getUTCFullYear(),
      mes: anterior.getUTCMonth() + 1,
      dia: anterior.getUTCDate(),
    },
    fuso,
  );
}
