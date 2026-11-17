import {
  type Action,
  can,
  conditions,
  instantToLocal,
  OPERATE_CAVEAT_STAGE,
  type Profile,
  type SessionState,
} from "@fila-saude/domain";
import type { Relationship } from "@fila-saude/schemas/queue";
import type { UserProfile } from "@/lib/navigation";

const inUnit = (profiles: UserProfile[], unitId: string) =>
  profiles.filter((p) => p.unitId === null || p.unitId === unitId).map((p) => p.profile);

/** Botões da fila do dia pela matriz, só com os perfis que valem na unidade (PD-38); a API confere de novo. */
export function queueActions(profiles: UserProfile[], unitId: string, sessionState: SessionState) {
  const list = inUnit(profiles, unitId);
  const p = (a: Action) => can(list, a);
  return {
    open: sessionState === "planned" && p("open_cancel_close_session"),
    close: sessionState === "open" && p("open_cancel_close_session"),
    attendance: sessionState === "open" && p("verify_and_mark_attendance"),
  };
}

const WEIGHT: Record<string, number> = { called: 0, present: 1, remote: 2 };

/** Chamado, na unidade, remotos e depois quem já saiu; dentro de cada grupo, pela senha. */
export function sortQueue<T extends { ticket: string; state: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (WEIGHT[a.state] ?? 3) - (WEIGHT[b.state] ?? 3) || a.ticket.localeCompare(b.ticket));
}

const LABELS: Record<string, string> = {
  remote: "A caminho",
  present: "Na unidade",
  called: "Chamado",
  done_in_stage: "Atendido",
  left_queue: "Saiu da fila",
  reassigned: "Remanejado",
};

export const stateLabel = (state: string): string => LABELS[state] ?? state;

/** Tempo desde a chamada (a tolerância é só um contador, AD-006). */
export function stopwatch(since: string, now: number): string {
  const s = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const PENDING_CHECKS: Record<string, string> = {
  account: "a conta",
  attended_person: "a pessoa atendida",
  pre_registration: "o pré-cadastro",
  priority: "a prioridade",
};

/** RN-FILA-05: o QR foi recusado e a recepção precisa conferir isto antes da presença. */
export function pendingChecksText(pendingChecks: string[]): string | null {
  if (pendingChecks.length === 0) return null;
  return `Passe na recepção: conferir ${pendingChecks.map((p) => PENDING_CHECKS[p] ?? p).join(", ")}`;
}

/**
 * RN-PRES-03 / RN-FILA-05: a recepção marca a presença de qualquer remoto (sem app, não conseguiu ler
 * o QR); com pendência, confere os documentos na mesma ação e pode recusar ("não confere", com motivo).
 */
export function attendanceButtons(
  item: { state: string; pendingChecks: string[] },
  canAttendance: boolean,
): { mark: string; notMatches: boolean } | null {
  if (!canAttendance || item.state !== "remote") return null;
  const pending = item.pendingChecks.length > 0;
  return { mark: pending ? "Conferir documentos e marcar presença" : "Marcar presença", notMatches: pending };
}

/** O que comparar com o documento: nascimento e CPF mascarado. */
export function documentText(d: { birthDate: string; cpf: string | null }): string {
  const [a, m, day] = d.birthDate.split("-");
  return `nasc. ${day}/${m}/${a} · ${d.cpf ? `CPF ${d.cpf}` : "sem CPF"}`;
}

/** PD-46: as estações da unidade que o perfil pode operar (a API recusaria as outras com 403). */
export function stationsItOperates<E extends { stage: "triage" | "care" }>(
  stations: E[],
  profiles: { profile: Profile; unitId: string | null }[],
  unitId: string,
): E[] {
  const valid = profiles.filter((p) => p.unitId === null || p.unitId === unitId).map((p) => p.profile);
  const c = conditions(valid, "operate_calls");
  if (c === null) return [];
  if (c === "free") return stations;
  const stages = new Set(c.map((r) => OPERATE_CAVEAT_STAGE[r]));
  return stations.filter((e) => stages.has(e.stage));
}

type ItemWithState = { ticket: string; state: string; pendingChecks: string[] };

/**
 * Fila do dia por situação, na ordem em que a equipe age: quem precisa da recepção, quem foi chamado,
 * quem está na unidade, quem está a caminho e, por último, quem já saiu. Dentro de cada grupo, pela senha.
 */
export function groupQueue<T extends ItemWithState>(items: T[]) {
  const byTicket = (l: T[]) => [...l].sort((a, b) => a.ticket.localeCompare(b.ticket));
  return {
    reception: byTicket(items.filter((i) => i.state === "remote" && i.pendingChecks.length > 0)),
    called: byTicket(items.filter((i) => i.state === "called")),
    inUnit: byTicket(items.filter((i) => i.state === "present")),
    onTheWay: byTicket(items.filter((i) => i.state === "remote" && i.pendingChecks.length === 0)),
    closed: byTicket(items.filter((i) => !["remote", "present", "called"].includes(i.state))),
  };
}

/** Números do topo da fila do dia. */
export function queueCounters(items: ItemWithState[]) {
  return {
    inUnit: items.filter((i) => i.state === "present").length,
    onTheWay: items.filter((i) => i.state === "remote").length,
    called: items.filter((i) => i.state === "called").length,
    attended: items.filter((i) => i.state === "done_in_stage").length,
  };
}

// ---------------------------------------------------------------------------------------------
// Fila do dia, caminho C (design system): a unidade inteira, com busca e pílulas por serviço.

const withoutAccents = (t: string) =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const onlyLettersAndNumbers = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
const LOOKS_LIKE_PASSWORD = /^[a-z]{1,3}-?\d+$/i;

/**
 * Busca do balcão, na hora e sem ir à API: nome (sem acento nem maiúscula), senha (com ou sem hífen)
 * e CPF — com os 11 dígitos do documento, compara os 6 do meio, que é o que o CPF mascarado mostra.
 */
export function searchQueue<T extends { name: string; ticket: string; document: { cpf: string | null } }>(
  items: T[],
  term: string,
): T[] {
  const t = term.trim();
  if (!t) return items;
  const digits = t.replace(/\D/g, "");
  if (digits.length === 11) {
    const middle = digits.slice(3, 9);
    return items.filter((i) => (i.document.cpf ?? "").replace(/\D/g, "") === middle);
  }
  if (LOOKS_LIKE_PASSWORD.test(t)) {
    const ticket = onlyLettersAndNumbers(t);
    return items.filter((i) => onlyLettersAndNumbers(i.ticket).includes(ticket));
  }
  const name = withoutAccents(t);
  return items.filter((i) => withoutAccents(i.name).includes(name));
}

/** Minutos inteiros desde `iso` (para baixo; nunca negativo, se o relógio do servidor estiver adiantado). */
export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export type RowContext = { text: string; time: string | null; tone: "neutral" | "alert" | "called" };

/**
 * O que a linha diz da pessoa, em partes separadas (sem "Info · Info · Info"): a situação, há quanto
 * tempo (quando se sabe) e o tom. O serviço a linha mostra à parte.
 */
export function rowContext(
  i: { state: string; stage: string; pendingChecks: string[]; since: string | null; station: string | null },
  now: number,
): RowContext {
  const minutes = i.since ? minutesSince(i.since, now) : null;
  const time = minutes === null ? null : minutes === 0 ? "agora" : `há ${minutes} min`;
  if (i.state === "called") return { text: i.station ? `chamado para ${i.station}` : "chamado", time, tone: "called" };
  if (i.state === "present")
    return { text: i.stage === "triage" ? "esperando a triagem" : "esperando o atendimento", time, tone: "neutral" };
  if (i.state === "remote" && i.pendingChecks.length > 0)
    return {
      text: `conferir ${i.pendingChecks.map((p) => PENDING_CHECKS[p] ?? p).join(", ")}`,
      time: null,
      tone: "alert",
    };
  if (i.state === "remote") return { text: "em casa", time: null, tone: "neutral" };
  return { text: stateLabel(i.state).toLowerCase(), time: null, tone: "neutral" };
}

/** A pílula de uma sessão de hoje: o serviço e, ao lado, quantos na fila ou quando abre. */
export function sessionPill(
  s: { service: string; state: string; start: string; counts: { inQueue: number } },
  timeZone: string,
): { label: string; detail: string; disabled: boolean } {
  const detail =
    s.state === "planned"
      ? `abre às ${instantToLocal(Date.parse(s.start), timeZone).slice(11, 16)}`
      : s.state === "closed"
        ? "encerrada"
        : s.state === "cancelled"
          ? "cancelada"
          : String(s.counts.inQueue);
  return { label: s.service, detail, disabled: s.state === "cancelled" };
}

/** O filtro guardado no navegador só vale se a sessão ainda está entre as de hoje; senão, "todas". */
export function validFilter(stored: string | null, sessions: { id: string }[]): string {
  return stored && sessions.some((s) => s.id === stored) ? stored : "todas";
}

/**
 * O que a Fila do dia diz quando não há ninguém nela: antes de abrir, quando abre e quantos já se
 * inscreveram (e, para quem abre a sessão, como abrir); aberta, que ainda não chegou ninguém.
 */
export function emptyQueue(
  sessions: { state: string; taken: number; start: string }[],
  timeZone: string,
  canOpen: boolean,
): string {
  const planned = sessions.filter((s) => s.state === "planned");
  if (planned.length === 0 || planned.length < sessions.filter((s) => s.state !== "cancelled").length)
    return "Ninguém na fila ainda. Quem se inscrever pelo app aparece aqui.";
  const first = [...planned].sort((a, b) => a.start.localeCompare(b.start))[0] as (typeof planned)[number];
  const hour = instantToLocal(Date.parse(first.start), timeZone).slice(11, 16);
  const signedUp = planned.reduce((n, s) => n + s.taken, 0);
  const howToOpen = canOpen ? " Escolha o serviço acima para abrir a sessão." : "";
  return `A fila abre às ${hour}. Inscritos até agora: ${signedUp}.${howToOpen}`;
}

const RELATIONSHIP: Record<Relationship, string> = {
  legal_guardian: "responsável legal",
  caregiver: "cuida no dia a dia",
  family_or_friend: "família ou amigo",
};

/** Quem inscreveu outra pessoa (2026-11-16): a pílula da linha, sem gênero ("por Bruno (responsável legal)"). */
export function guardianText(r: { name: string; relationship: Relationship | null } | null) {
  if (!r) return null;
  if (!r.relationship) return { text: `por ${r.name}`, label: `inscrição feita por ${r.name}` };
  return {
    text: `por ${r.name} (${RELATIONSHIP[r.relationship]})`,
    label: `inscrição feita por ${r.name}, ${RELATIONSHIP[r.relationship]}`,
  };
}
