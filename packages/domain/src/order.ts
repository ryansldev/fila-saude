import type { MunicipalityOrder, RiskLevel } from "./kinds.ts";
import { type LegalPriority, rankPriority } from "./priority.ts";

/**
 * Risco vigente na fila. Emergência sugerida pelo app nunca entra (vai ao 192); emergência só
 * existe na fila quando a triagem dá vermelho e a pessoa é atendida aqui (AD-059).
 */
export type Risk = RiskLevel;

const RISK_WEIGHT: Record<Risk, number> = { emergency: 4, very_urgent: 3, urgent: 2, attention: 1, routine: 0 };

/** Chave da ordem de chamada (RN-ORD). `risco` é o vigente: confirmado, se houver; senão, sugerido. */
export type OrderKey = {
  confirmedUrgency: boolean;
  risk: Risk;
  priority: LegalPriority;
  number: number;
};

/** Chave da ordem da sugestão de alocação (RN-AL-02). */
export type SuggestionKey = {
  confirmedUrgency: boolean;
  reassigned: boolean;
  risk: Risk;
  priority: LegalPriority;
  originalEntryDate: number;
  id: string;
};

const signal = (n: number): number => (n < 0 ? -1 : n > 0 ? 1 : 0);

/** Maior vem antes: negativo quando `a` precede `b`. */
const largestFirst = (a: number, b: number): number => signal(b - a);

/**
 * Risco e prioridade legal na ordem do município. Entre urgências confirmadas pela triagem, o risco vem
 * sempre antes (AD-058/AD-059: vermelho em 1º, laranja antes de amarelo); a prioridade legal só desempata.
 */
function criteria(
  a: { confirmedUrgency: boolean; risk: Risk; priority: LegalPriority },
  b: { confirmedUrgency: boolean; risk: Risk; priority: LegalPriority },
  municipalityOrder: MunicipalityOrder,
): number {
  const risk = largestFirst(RISK_WEIGHT[a.risk], RISK_WEIGHT[b.risk]);
  const legal = largestFirst(rankPriority(a.priority), rankPriority(b.priority));
  const riskFirst = municipalityOrder === "risk" || (a.confirmedUrgency && b.confirmedUrgency);
  return riskFirst ? risk || legal : legal || risk;
}

/** Ordem total: urgência confirmada, risco e prioridade (na ordem do município), número. */
export function compareOrder(a: OrderKey, b: OrderKey, municipalityOrder: MunicipalityOrder): number {
  return (
    largestFirst(Number(a.confirmedUrgency), Number(b.confirmedUrgency)) ||
    criteria(a, b, municipalityOrder) ||
    signal(a.number - b.number)
  );
}

/** Urgência, remanejadas, risco e prioridade (ordem do município), data original, id. */
export function compareSuggestion(a: SuggestionKey, b: SuggestionKey, municipalityOrder: MunicipalityOrder): number {
  return (
    largestFirst(Number(a.confirmedUrgency), Number(b.confirmedUrgency)) ||
    largestFirst(Number(a.reassigned), Number(b.reassigned)) ||
    criteria(a, b, municipalityOrder) ||
    signal(a.originalEntryDate - b.originalEntryDate) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
