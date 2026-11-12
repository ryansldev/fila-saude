export type Intervalo = { abre: string; fecha: string };
export type ChaveDia = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type Horario = Partial<Record<ChaveDia, Intervalo[]>>;

/** Dias na ordem da semana de trabalho (segunda primeiro); a chave é a da API (0 = domingo). */
export const DIAS: { chave: ChaveDia; nome: string; curto: string }[] = [
  { chave: "1", nome: "Segunda", curto: "Seg" },
  { chave: "2", nome: "Terça", curto: "Ter" },
  { chave: "3", nome: "Quarta", curto: "Qua" },
  { chave: "4", nome: "Quinta", curto: "Qui" },
  { chave: "5", nome: "Sexta", curto: "Sex" },
  { chave: "6", nome: "Sábado", curto: "Sáb" },
  { chave: "0", nome: "Domingo", curto: "Dom" },
];

export const HORARIO_PADRAO: Horario = Object.fromEntries(
  (["1", "2", "3", "4", "5"] as ChaveDia[]).map((d) => [d, [{ abre: "07:00", fecha: "17:00" }]]),
);

const minutos = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Novo intervalo: 1 h depois do fim do último (até 4 h de duração); no dia vazio, 07:00–12:00. */
export function adicionarIntervalo(h: Horario, dia: ChaveDia): Horario {
  const atuais = h[dia] ?? [];
  const ultimo = atuais.at(-1);
  if (!ultimo) return { ...h, [dia]: [{ abre: "07:00", fecha: "12:00" }] };
  const inicio = Math.min(minutos(ultimo.fecha) + 60, 23 * 60);
  const fim = Math.min(inicio + 4 * 60, 23 * 60 + 59);
  return { ...h, [dia]: [...atuais, { abre: hhmm(inicio), fecha: hhmm(fim) }] };
}

/** Erros por intervalo (`horario.<dia>.<índice>`), os mesmos que a API recusaria. */
export function problemasDoHorario(h: Horario): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const [dia, lista] of Object.entries(h)) {
    (lista ?? []).forEach((iv, i) => {
      if (iv.fecha <= iv.abre) erros[`horario.${dia}.${i}`] = "O fim deve ser depois do início.";
    });
    (lista ?? []).forEach((iv, i) => {
      if (erros[`horario.${dia}.${i}`]) return;
      const sobrepoe = (lista ?? []).some((outro, j) => j < i && iv.abre < outro.fecha && outro.abre < iv.fecha);
      if (sobrepoe) erros[`horario.${dia}.${i}`] = "Sobrepõe outro intervalo do dia.";
    });
  }
  return erros;
}

const textoDoDia = (lista: Intervalo[] | undefined) =>
  [...(lista ?? [])]
    .sort((a, b) => a.abre.localeCompare(b.abre))
    .map((iv) => `${iv.abre}–${iv.fecha}`)
    .join(", ");

/** "Seg a Sex 07:00–17:00 · Sáb 08:00–12:00": dias seguidos com o mesmo horário viram uma faixa. */
export function resumoDoHorario(h: Horario): string {
  const partes: string[] = [];
  let i = 0;
  while (i < DIAS.length) {
    const texto = textoDoDia(h[DIAS[i]?.chave as ChaveDia]);
    let j = i;
    while (j + 1 < DIAS.length && textoDoDia(h[DIAS[j + 1]?.chave as ChaveDia]) === texto) j++;
    if (texto) partes.push(`${DIAS[i]?.curto}${j > i ? ` a ${DIAS[j]?.curto}` : ""} ${texto}`);
    i = j + 1;
  }
  return partes.length > 0 ? partes.join(" · ") : "Sem horário definido";
}
