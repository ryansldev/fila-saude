/** Data e hora no fuso da unidade: "qua., 18/11 às 08:00". */
export function quandoNoFuso(iso: string, fuso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  const semana = p("weekday").replace(/\.?$/, ".");
  return `${semana}, ${p("day")}/${p("month")} às ${p("hour")}:${p("minute")}`;
}

/** RN-AL-06: quantas vagas a sessão já tem ocupadas. */
export const textoDasVagas = (ocupadas: number, vagas: number | null): string =>
  vagas === null ? `${ocupadas} alocados · sem limite` : `${ocupadas} de ${vagas} vagas`;

export type Tom = "neutro" | "alerta" | "ok";

const ESTADOS: Record<string, { rotulo: string; tom: Tom }> = {
  confirmada: { rotulo: "Confirmou", tom: "ok" },
  na_fila: { rotulo: "Na fila", tom: "ok" },
  concluida: { rotulo: "Atendida", tom: "ok" },
};

/** RN-CONF-03: alocação pendente fica destacada depois do prazo (24 h ou o início da sessão). */
export function situacaoDoAlocado(a: { estado: string; destacada: boolean }): { rotulo: string; tom: Tom } {
  if (a.estado === "alocada")
    return a.destacada
      ? { rotulo: "Sem resposta: ligar", tom: "alerta" }
      : { rotulo: "Aguardando resposta", tom: "neutro" };
  return ESTADOS[a.estado] ?? { rotulo: a.estado, tom: "neutro" };
}

const NIVEIS: Record<string, string> = {
  emergencia: "Emergência",
  muito_urgente: "Muito urgente",
  urgente: "Urgente",
  atencao: "Atenção",
  rotina: "Rotina",
};

/** RN-RISCO-01: o agendador vê se o risco é o sugerido pelo app ou o confirmado na triagem. */
export const rotuloDoRisco = (r: { nivel: string; confirmado: boolean }): string =>
  `${NIVEIS[r.nivel] ?? r.nivel} · ${r.confirmado ? "confirmado" : "sugerido pelo app"}`;

export const CLASSES_DO_TOM: Record<Tom, string> = {
  neutro: "bg-slate-100 text-slate-700",
  alerta: "bg-amber-100 text-amber-900",
  ok: "bg-emerald-100 text-emerald-800",
};
