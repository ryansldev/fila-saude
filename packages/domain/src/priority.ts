import type { DeclaredGroup } from "./kinds.ts";
import { ageAt } from "./time.ts";

/** Grupos de prioridade legal (RN-RISCO-04, AD-025). Lista fixa no código no MVP. */
export type Group =
  | "elderly"
  | "elderly80"
  | "pregnant"
  | "breastfeeding"
  | "infant"
  | "disability"
  | "autism"
  | "mobility"
  | "donor"
  | "obesity";

type Verification = "visual" | "document" | "birthDate" | "to_define";

/**
 * Como cada grupo é conferido na recepção e por quantos dias a conferência vale.
 * TODO(D5): prazo de gestante, lactante e criança de colo ainda a definir; `null` = sem prazo até lá.
 */
export const GROUPS: Record<Group, { verification: Verification; expiresInDays: number | null }> = {
  elderly: { verification: "birthDate", expiresInDays: null },
  elderly80: { verification: "birthDate", expiresInDays: null },
  pregnant: { verification: "visual", expiresInDays: null },
  infant: { verification: "visual", expiresInDays: null },
  disability: { verification: "document", expiresInDays: null },
  autism: { verification: "document", expiresInDays: null },
  breastfeeding: { verification: "to_define", expiresInDays: null },
  mobility: { verification: "to_define", expiresInDays: null },
  donor: { verification: "to_define", expiresInDays: null },
  obesity: { verification: "to_define", expiresInDays: null },
};

export type LegalPriority = {
  groups: Group[];
  verified: boolean;
  verifiedAt: number | null;
};

const DAY_MS = 86_400_000;

const FROM_DECLARED: Record<DeclaredGroup, Group> = {
  pregnant: "pregnant",
  breastfeeding: "breastfeeding",
  infant_in_arms: "infant",
  disability: "disability",
  autism: "autism",
  reduced_mobility: "mobility",
  blood_donor: "donor",
  obesity: "obesity",
};

/** Traduz a resposta da Tela 5 para o grupo do domínio. */
export function groupFromDeclared(declared: DeclaredGroup): Group {
  return FROM_DECLARED[declared];
}

/**
 * Grupos da pessoa atendida (AD-027): idoso e idoso80 vêm só da data de nascimento;
 * os declarados (inclusive criança de colo) são mantidos; nada do acompanhante entra.
 */
export function personPriority(
  person: { birthDate: string },
  declared: Group[],
  now: number,
  timeZone: string,
): Group[] {
  const age = ageAt(person.birthDate, now, timeZone);
  const groups: Group[] = [];
  if (age >= 80) groups.push("elderly80");
  else if (age >= 60) groups.push("elderly");
  for (const g of declared) {
    if (g === "elderly" || g === "elderly80" || groups.includes(g)) continue;
    groups.push(g);
  }
  return groups;
}

/** Onde a recepção está ao tentar dar prioridade legal (RN-RISCO-04, matriz de permissões). */
export type GivePriorityContext = "desk_addition" | "first_attendance_without_app" | "already_in_queue";

/** Dar prioridade só na inclusão pelo balcão ou na 1ª presença de paciente sem app; na fila, só conferir ou tirar. */
export function canGivePriority(context: GivePriorityContext): boolean {
  return context === "desk_addition" || context === "first_attendance_without_app";
}

/** Idoso e idoso80 vêm da data de nascimento (AD-027): não são declarados nem dados pela recepção. */
export const fromAge = (g: Group): boolean => GROUPS[g].verification === "birthDate";

/**
 * Grupos que a recepção confere (RN-FILA-05 (c)): os declarados. Idoso não entra: a idade vem da
 * data de nascimento, coberta pela conferência de identidade (pendência (a)). DECISÃO F1.
 */
export const toVerify = (p: LegalPriority): Group[] => p.groups.filter((g) => !fromAge(g));

/** Declarada vale até a conferência (AD-024/050). */
export function hasPriority(p: LegalPriority): boolean {
  return p.groups.length > 0;
}

/** 2 = 80+, 1 = qualquer outro grupo (sem hierarquia entre eles), 0 = nenhum. */
export function rankPriority(p: LegalPriority): 0 | 1 | 2 {
  if (p.groups.includes("elderly80")) return 2;
  return p.groups.length > 0 ? 1 : 0;
}

/**
 * Conferida há `expiresInDays` ou mais dias: expira e volta a ser conferida.
 * `deadlines` permite sobrepor os padrões de GRUPOS (configuração, D5).
 */
export function expired(p: LegalPriority, now: number, deadlines: Partial<Record<Group, number | null>> = {}): boolean {
  if (!p.verified || p.verifiedAt === null) return false;
  const verifiedAt = p.verifiedAt;
  return p.groups.some((g) => {
    const days = deadlines[g] ?? GROUPS[g].expiresInDays;
    return days !== null && now - verifiedAt >= days * DAY_MS;
  });
}
