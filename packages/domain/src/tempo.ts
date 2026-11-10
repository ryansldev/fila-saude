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

/** Epoch ms de 00:00 da data local no fuso. */
function meiaNoite({ ano, mes, dia }: DataLocal, fuso: string): number {
  const alvo = Date.UTC(ano, mes - 1, dia);
  let chute = alvo;
  // O deslocamento do fuso pode mudar entre o chute e o resultado (horário de verão): refina.
  for (let i = 0; i < 3; i++) {
    const proximo = alvo - (relogioLocalComoUtc(chute, fuso) - chute);
    if (proximo === chute) break;
    chute = proximo;
  }
  return chute;
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
