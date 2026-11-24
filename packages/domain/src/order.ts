import type { MunicipalityOrder, RiskLevel } from "./kinds.ts";
import { elderlyLevel, type LegalPriority, rankPriority } from "./priority.ts";

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

/**
 * Urgência confirmada, risco e prioridade (na ordem do município), número. Compara dois, sem o 80+: para
 * a ordem de verdade use `orderItems` (RV7).
 */
export function compareOrder(a: OrderKey, b: OrderKey, municipalityOrder: MunicipalityOrder): number {
  return (
    largestFirst(Number(a.confirmedUrgency), Number(b.confirmedUrgency)) ||
    criteria(a, b, municipalityOrder) ||
    signal(a.number - b.number)
  );
}

/** Urgência, remanejadas, risco e prioridade (ordem do município), data original, id. Sem o 80+: ver `orderSuggestions`. */
export function compareSuggestion(a: SuggestionKey, b: SuggestionKey, municipalityOrder: MunicipalityOrder): number {
  return (
    largestFirst(Number(a.confirmedUrgency), Number(b.confirmedUrgency)) ||
    largestFirst(Number(a.reassigned), Number(b.reassigned)) ||
    criteria(a, b, municipalityOrder) ||
    signal(a.originalEntryDate - b.originalEntryDate) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Quem ocupa uma vaga de idoso (RV7): todo 80+, e o idoso de 60-79 sem outro grupo de prioridade (PL1).
 */
const slotHolder = (p: LegalPriority): boolean => {
  const level = elderlyLevel(p);
  return level === 2 || (level === 1 && p.groups.every((g) => g === "elderly"));
};

/**
 * RV7: entre as pessoas idosas, os maiores de 80 anos vêm antes (Lei 10.741, art. 3º, § 2º); entre grupos
 * diferentes não há hierarquia (Lei 10.048). Comparando dois de cada vez essas regras formam um ciclo
 * (80+ antes de 60-79, os dois empatados com uma gestante entre eles), então a regra vale na fila inteira:
 * já em ordem, dentro de cada bloco de quem tem prioridade com o mesmo nível de urgência e risco, as vagas
 * ocupadas por idosos vão primeiro aos 80+, cada grupo na ordem em que já estava. Os outros grupos ficam no
 * lugar que a senha lhes dá, inclusive o idoso de 60-79 que também é de outro grupo (gestante, PcD...): sem
 * hierarquia entre os grupos, esse lugar ele já tem pelo outro grupo (PL1, a confirmar com o advogado, D5).
 * O 80+ entra nas vagas mesmo sendo de outro grupo: declarar mais um grupo nunca piora o lugar.
 */
function elderlySlots<T>(sorted: T[], block: (a: T, b: T) => boolean, priority: (t: T) => LegalPriority): T[] {
  const out = [...sorted];
  let start = 0;
  while (start < out.length) {
    let end = start + 1;
    while (end < out.length && block(out[start] as T, out[end] as T)) end++;
    const slots: number[] = [];
    for (let i = start; i < end; i++) if (slotHolder(priority(out[i] as T))) slots.push(i);
    const elderly = slots.map((i) => out[i] as T);
    const reordered = [
      ...elderly.filter((t) => elderlyLevel(priority(t)) === 2),
      ...elderly.filter((t) => elderlyLevel(priority(t)) === 1),
    ];
    slots.forEach((i, k) => {
      out[i] = reordered[k] as T;
    });
    start = end;
  }
  return out;
}

const sameBlock = (
  a: { confirmedUrgency: boolean; risk: Risk; priority: LegalPriority },
  b: { confirmedUrgency: boolean; risk: Risk; priority: LegalPriority },
): boolean =>
  a.confirmedUrgency === b.confirmedUrgency &&
  a.risk === b.risk &&
  rankPriority(a.priority) === 1 &&
  rankPriority(b.priority) === 1;

/** A ordem de chamada (RN-ORD) de um conjunto, com o 80+ antes dos demais idosos (RV7). */
export function orderItems<T>(items: T[], key: (t: T) => OrderKey, municipalityOrder: MunicipalityOrder): T[] {
  const sorted = [...items].sort((a, b) => compareOrder(key(a), key(b), municipalityOrder));
  return elderlySlots(
    sorted,
    (a, b) => sameBlock(key(a), key(b)),
    (t) => key(t).priority,
  );
}

/** A ordem da sugestão de alocação (RN-AL-02), com o 80+ antes dos demais idosos (RV7). */
export function orderSuggestions<T>(
  items: T[],
  key: (t: T) => SuggestionKey,
  municipalityOrder: MunicipalityOrder,
): T[] {
  const sorted = [...items].sort((a, b) => compareSuggestion(key(a), key(b), municipalityOrder));
  return elderlySlots(
    sorted,
    (a, b) => sameBlock(key(a), key(b)) && key(a).reassigned === key(b).reassigned,
    (t) => key(t).priority,
  );
}
