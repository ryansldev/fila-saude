import { vespera } from "@fila-saude/domain";

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

export type Barra = "confirmada" | "pendente" | "livre";

/** As barrinhas de vagas da sessão; sem limite de vagas não há o que desenhar (`null`). */
export function barrasDeVagas(s: { vagas: number | null; confirmadas: number; pendentes: number }): Barra[] | null {
  if (s.vagas === null) return null;
  const confirmadas = Math.min(s.confirmadas, s.vagas);
  const pendentes = Math.min(s.pendentes, s.vagas - confirmadas);
  return [
    ...Array<Barra>(confirmadas).fill("confirmada"),
    ...Array<Barra>(pendentes).fill("pendente"),
    ...Array<Barra>(s.vagas - confirmadas - pendentes).fill("livre"),
  ];
}

/**
 * RN-RISCO-01: um selo só por pessoa; "(app)" quando é o sugerido, sem ele quando a triagem confirmou.
 * Rotina sugerida não leva selo: só o risco que muda a ordem chama atenção.
 */
export function seloDoRisco(r: { nivel: string; confirmado: boolean }): {
  rotulo: string;
  tom: "alerta" | "neutro" | "perigo";
} | null {
  if (r.nivel === "rotina" && !r.confirmado) return null;
  const nome = NIVEIS[r.nivel] ?? r.nivel;
  const tom =
    r.nivel === "emergencia" ? "perigo" : r.nivel === "urgente" || r.nivel === "muito_urgente" ? "alerta" : "neutro";
  return { rotulo: r.confirmado ? nome : `${nome} (app)`, tom };
}

/** A linha "por quê" da sugestão: a regra do questionário (menos a de rotina) e os demais motivos. */
export const linhaDeMotivos = (risco: { nivel: string; regra: string }, motivos: string[]): string =>
  [...(risco.nivel === "rotina" ? [] : [risco.regra]), ...motivos].join(" · ");

/** RN-CONF-03: a faixa do topo: quantas pessoas para ligar e quem espera resposta há mais tempo. */
export function resumoDasPendencias(
  itens: { nome: string; alocadaEm: string }[],
  agora: number,
): { total: number; texto: string } | null {
  if (itens.length === 0) return null;
  const maisAntigo = itens.reduce((a, b) => (Date.parse(b.alocadaEm) < Date.parse(a.alocadaEm) ? b : a));
  const horas = Math.max(0, Math.floor((agora - Date.parse(maisAntigo.alocadaEm)) / 3_600_000));
  const quantas = itens.length === 1 ? "1 pessoa para ligar" : `${itens.length} pessoas para ligar`;
  return { total: itens.length, texto: `${quantas} · ${maisAntigo.nome} sem resposta há ${horas} h` };
}

/** RN-AL-05: até quando dá para alocar (a véspera da sessão, no fuso da unidade): "seg., 16/11". */
export function alocarAte(inicio: string, fuso: string): string {
  return quandoNoFuso(new Date(vespera(Date.parse(inicio), fuso)).toISOString(), fuso).split(" às ")[0] ?? "";
}
