import { INACTIVE_ENTRY_STATES, MAX_PER_ACCOUNT, samePerson } from "@fila-saude/domain";
import type { MyEntry, Relationship, SignUpInput } from "@fila-saude/schemas/queue";
import { ApiError } from "./api";
import { errorMessage } from "./texts";
import { ACCOUNT_CPF, dataIso } from "./validation";

/**
 * Estados em que a entrada terminou: deixam a pessoa livre para se inscrever de novo no serviço.
 * Remanejada NÃO é final: a pessoa continua no serviço, esperando a unidade marcar outra data.
 */
const FINAL_STATES = new Set<string>(INACTIVE_ENTRY_STATES);

export const activeEntry = (e: Pick<MyEntry, "state">) => !FINAL_STATES.has(e.state);

/** RN-ID-07 (enxuto, mesmo número da API): uma conta inscreve até 5 pessoas por atendimento. */

/** AD-032: o dono da conta já tem uma entrada ativa neste serviço (então "para mim" não pode de novo). */
export function forMeInService(mine: MyEntry[] | null, serviceId: string | undefined): boolean {
  if (!mine || !serviceId) return false;
  return mine.some((e) => e.forMe && e.serviceId === serviceId && activeEntry(e));
}

export type SignUpInSchedule = { kind: "free" } | { kind: "signed_up"; badge: string; canOther: boolean };

/** O selo da agenda diz como o dono está no serviço (nesta data, na lista, na reserva...). */
function ownerBadge(e: MyEntry, sessionId: string): string {
  if (e.state === "reassigned") return "nova data";
  if (e.state === "in_reserve") return "na reserva";
  if (e.state === "waiting" || !e.session) return "lista de espera";
  if (e.session.id === sessionId) return "inscrito";
  return "já tem data";
}

/**
 * Como a agenda mostra a sessão para a conta: "inscrito" quando o dono já está no serviço (nesta data
 * ou noutra). O cartão continua tocável para inscrever outra pessoa, até o limite da conta nesta data.
 * Sem "minhas" (carregando ou falhou), fica livre: a API ainda recusa a duplicada.
 */
export function signUpInSchedule(
  session: { id: string; service: { id: string } },
  mine: MyEntry[] | null,
): SignUpInSchedule {
  const active = (mine ?? []).filter(activeEntry);
  const my = active.find((e) => e.forMe && e.serviceId === session.service.id);
  if (!my) return { kind: "free" };
  const inThisSession = active.filter((e) => e.session?.id === session.id).length;
  return { kind: "signed_up", badge: ownerBadge(my, session.id), canOther: inThisSession < MAX_PER_ACCOUNT };
}

type Person = { name: string; birthDate: string; cpf?: string | null | undefined };

/**
 * A conta já inscreveu esta "outra pessoa" no serviço: evita mandar a mesma pessoa duas vezes.
 * `pessoa.nascimento` é AAAA-MM-DD (vazio enquanto a data está incompleta: aí não acusa nada).
 * A lista "minhas" não traz o CPF de quem foi inscrito: a comparação fica em nome + nascimento.
 */
export function otherPersonAlreadySignedUp(mine: MyEntry[] | null, serviceId: string | undefined, person: Person) {
  if (!mine || !serviceId || !person.birthDate) return false;
  return mine.some(
    (e) =>
      !e.forMe &&
      e.serviceId === serviceId &&
      activeEntry(e) &&
      samePerson({ name: e.person, birthDate: e.birthDate }, person),
  );
}

export type CheckError =
  | { kind: "field"; field: "cpf"; text: string }
  | { kind: "person"; text: string }
  | { kind: "banner"; title: string; text: string; exit: "schedule" | "queue" | null };

const BY_EXIT: Record<string, { title: string; text?: string; exit: "schedule" | "queue" }> = {
  session_closed: { title: "este atendimento não está aberto", exit: "schedule" },
  private_session: { title: "este atendimento não está aberto", exit: "schedule" },
  triage_closed: { title: "a triagem está fechada agora", exit: "schedule" },
  limit_per_account: { title: "limite de pessoas da conta", exit: "queue" },
  referral_pending: { title: "falta o pedido médico", exit: "queue" },
  duplicate: { title: "já inscrito neste serviço", exit: "queue" },
};

/** Onde o passo "para quem" mostra a recusa do /verificar (a mesma que a inscrição daria). */
export function checkError(err: unknown): CheckError {
  const code = err instanceof ApiError ? err.error : "";
  if (code === "own_account_cpf") return { kind: "field", field: "cpf", text: ACCOUNT_CPF };
  if (code === "person_has_account")
    return {
      kind: "field",
      field: "cpf",
      text: "essa pessoa já tem conta no fila saúde. ela se inscreve pela própria conta.",
    };
  if (code === "invalid_cpf") return { kind: "field", field: "cpf", text: "CPF inválido. confira os números." };
  if (code === "person_mismatch")
    return {
      kind: "person",
      text: "esse CPF já está cadastrado com outro nome ou outra data. confira os dados ou procure a recepção.",
    };
  const exit = BY_EXIT[code];
  if (exit) return { kind: "banner", title: exit.title, text: errorMessage(err), exit: exit.exit };
  return { kind: "banner", title: "não deu para conferir", text: errorMessage(err), exit: null };
}

/** A mesma tela serve à inscrição numa sessão, à entrada na lista de espera e a refazer o questionário. */
export type SignUpMode = "session" | "list" | "redo";

/** O endereço da tela fica em português: `/inscricao/lista` e `/inscricao/refazer`. */
export const SIGN_UP_PATH: Record<Exclude<SignUpMode, "session">, string> = { list: "lista", redo: "refazer" };

export const signUpMode = (sessionId: string | undefined): SignUpMode =>
  sessionId === SIGN_UP_PATH.list ? "list" : sessionId === SIGN_UP_PATH.redo ? "redo" : "session";

/** Para onde a tela manda as respostas; só a sessão confere antes, no passo "para quem". */
export function signUpRequest(
  mode: SignUpMode,
  municipality: string,
  ids: { sessionId?: string | undefined; serviceId?: string | undefined; entryId?: string | undefined },
): { send: string; check: string | null } {
  const m = `/v1/municipalities/${municipality}`;
  if (mode === "list") return { send: `${m}/services/${ids.serviceId}/entries`, check: null };
  if (mode === "redo") return { send: `${m}/entries/${ids.entryId}/questionnaire`, check: null };
  return {
    send: `${m}/sessions/${ids.sessionId}/sign-ups`,
    check: `${m}/sessions/${ids.sessionId}/sign-ups/check`,
  };
}

export type ServiceWithList = {
  id: string;
  name: string;
  /** entrar: abre "para quem"; na_lista: o dono já está; requisicao (I2) e regulado (RN-ENC-05): só explicam. */
  kind: "sign_in" | "in_list" | "referral" | "regulated";
};

/** I1: os serviços da unidade na página dela, com o que dá para fazer em cada um. */
export function servicesWithList(
  services: { id: string; name: string; mode: "direct" | "referral" | "regulated" }[],
  mine: MyEntry[] | null,
): ServiceWithList[] {
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    kind:
      s.mode === "regulated"
        ? "regulated"
        : s.mode === "referral"
          ? "referral"
          : forMeInService(mine, s.id)
            ? "in_list"
            : "sign_in",
  }));
}

/**
 * RN-RISCO-03 / RN-PIORA-01: refazer o questionário pelo app na lista ou na fila do dia ainda em casa;
 * na unidade vale "meus sintomas pioraram".
 */
export const canRedo = (e: Pick<MyEntry, "state" | "itemState">): boolean =>
  ["waiting", "allocated", "confirmed"].includes(e.state) || (e.state === "in_queue" && e.itemState === "remote");

/** Quem inscreve outra pessoa diz o que é dela (2026-11-16), como as pessoas se veem. Textos provisórios até o D5. */
export const RELATIONSHIPS: readonly { id: Relationship; text: (name: string) => string }[] = [
  { id: "legal_guardian", text: (n) => `sou mãe, pai ou responsável legal de ${n}` },
  { id: "caregiver", text: (n) => `cuido de ${n} no dia a dia` },
  { id: "family_or_friend", text: (n) => `sou da família ou amigo de ${n} e estou ajudando` },
];

/**
 * A declaração depende da relação: só o responsável legal (pais, tutor, curador) responde pela pessoa; para
 * quem cuida ou ajuda um adulto, vale que ele saiba e concorde (mandato, Código Civil art. 656). O dado de
 * saúde em si é tratado pelo município sem depender disso (LGPD art. 11, II). Provisório até o D5.
 */
export const declaration = (relationship: Relationship, name: string) =>
  relationship === "legal_guardian"
    ? `declaro que sou responsável legal por ${name}`
    : `${name} sabe e concorda com esta inscrição`;

/** Os dados de outra pessoa, uma tela cada; a relação fecha. */
export type PersonStep = "name" | "birthDate" | "cpf" | "relationship";

/** Recusa da conferência (`/verificar`) num dado: a tela para onde a pessoa volta para corrigir. */
export function stepOfError(e: CheckError): PersonStep | null {
  if (e.kind === "field") return "cpf";
  if (e.kind === "person") return "name";
  return null;
}

export type SignUpEnd = "signed_up" | "list" | "reserve" | "request" | "redone";

/** O "pronto!" (2026-11-16): título curto e a frase, sem "(a)"; para outra pessoa, com o nome dela. */
export function doneTitle(
  end: SignUpEnd,
  forWhom: "me" | "other" | null,
  name: string,
): { title: string; text: string } {
  const other = forWhom === "other";
  switch (end) {
    case "signed_up":
      return { title: "prontinho!", text: other ? `a vaga de ${name} está garantida.` : "a vaga é sua." };
    case "list":
      return {
        title: "prontinho!",
        text: other ? `${name} está na lista de espera.` : "você está na lista de espera.",
      };
    case "reserve":
      return {
        title: "as vagas acabaram",
        text: other ? `${name} está na lista de reserva desta data.` : "você está na lista de reserva desta data.",
      };
    case "request":
      return { title: "falta o pedido médico", text: "leve o pedido na recepção da unidade antes do dia." };
    case "redone":
      return { title: "respostas atualizadas", text: "a unidade já vê as respostas novas." };
  }
}

/**
 * O "para quem" que vai à API. Para outra pessoa, só com a relação escolhida e a declaração marcada pela
 * pessoa: sem as duas, `null` (nada é enviado em nome de quem não declarou).
 */
export function signUpForWhom(
  forWhom: "me" | "other",
  other: { name: string; birthDate: string; cpf: string },
  relationship: Relationship | null,
  declared: boolean,
): SignUpInput["forWhom"] | null {
  if (forWhom === "me") return { kind: "me" };
  if (!relationship || !declared) return null;
  return {
    kind: "other",
    name: other.name.trim(),
    birthDate: dataIso(other.birthDate),
    cpf: other.cpf.trim() ? other.cpf : null,
    relationship,
    declared: true,
  };
}
