import { partesDoDia } from "@/lib/datas";

const FUSO = "America/Sao_Paulo";
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Um botão da faixa de dias da unidade. `chave` é o dia no fuso ("2026-11-16"). */
export type DiaDaFaixa = { chave: string; topo: string; dia: string; mesAno: string };

/** "2026-11-16": o dia de `iso` no fuso da unidade. */
export function chaveDoDia(iso: string, fuso = FUSO): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

const partes = (chave: string) => {
  const [a, m, d] = chave.split("-").map(Number);
  return { ano: a ?? 0, mes: m ?? 1, dia: d ?? 1 };
};

/** "novembro de 2026". */
export function mesAno(chave: string): string {
  const { ano, mes } = partes(chave);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** "quarta, 25 de novembro". */
export function diaPorExtenso(chave: string): string {
  const { ano, mes, dia } = partes(chave);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return `${SEMANA_LONGA[semana]}, ${dia} de ${MESES[mes - 1]}`;
}

/** Os dias que têm atendimento, um por dia, em ordem (a faixa pula os dias vazios). */
export function diasComAtendimento(inicios: string[], agora: number, fuso = FUSO): DiaDaFaixa[] {
  const porDia = new Map<string, string>();
  for (const i of [...inicios].sort()) {
    const chave = chaveDoDia(i, fuso);
    if (!porDia.has(chave)) porDia.set(chave, i);
  }
  return [...porDia]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, iso]) => {
      const p = partesDoDia(iso, agora, fuso);
      return { chave, topo: p.topo, dia: p.dia, mesAno: mesAno(chave) };
    });
}

export type CelulaDoMes = { chave: string; dia: number; tem: boolean; hoje: boolean } | null;

/** O mês em semanas de domingo a sábado (`null` fora do mês), com os dias que têm atendimento. */
export function gradeDoMes(ano: number, mes: number, comAtendimento: Set<string>, hoje: string): CelulaDoMes[][] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas: CelulaDoMes[] = Array.from({ length: primeiro }, () => null);
  for (let d = 1; d <= total; d++) {
    const chave = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    celulas.push({ chave, dia: d, tem: comAtendimento.has(chave), hoje: chave === hoje });
  }
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: CelulaDoMes[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** O dia escolhido, se ainda tem atendimento; senão, o primeiro da faixa. */
export function diaValido(escolhido: string | null, dias: DiaDaFaixa[]): string | null {
  if (escolhido && dias.some((d) => d.chave === escolhido)) return escolhido;
  return dias[0]?.chave ?? null;
}
