import {
  type Assignments,
  canRegister,
  OCCUPATIONS,
  type Occupation,
  ROLES,
  type Role,
  staffProblems,
} from "@fila-saude/domain";

export type { Assignments, Occupation, Role };
export { OCCUPATIONS, ROLES };

const ALL_ROLES = Object.keys(ROLES) as Role[];
export const ALL_OCCUPATIONS = Object.keys(OCCUPATIONS) as Occupation[];

const isSms = (a: Assignments) => a.roles.some((f) => f.role === "sms_management");
const manages = (a: Assignments) => new Set(a.roles.filter((f) => f.role === "unit_manager").map((f) => f.unitId));

/** RN-PERF-04: SMS concede qualquer função; o gerente, só "agendar"; os outros, nada. */
export function grantableRoles(actor: Assignments): Role[] {
  if (isSms(actor)) return ALL_ROLES;
  return manages(actor).size > 0 ? ["scheduler"] : [];
}

/** SMS atribui em qualquer unidade; o gerente, só nas que ele gerencia. */
export function assignableUnits<U extends { id: string }>(actor: Assignments, units: U[]): U[] {
  if (isSms(actor)) return units;
  const mine = manages(actor);
  return units.filter((u) => mine.has(u.id));
}

/** Problemas de forma (escopo) e de permissão, antes de enviar. */
export function registrationProblems(actor: Assignments, target: Assignments): Record<string, string> {
  const shape = staffProblems(target);
  if (Object.keys(shape).length > 0) return shape;
  if (!canRegister(actor, target)) return { _: "Você só cadastra a equipe da sua unidade, sem função de gestão." };
  return {};
}

/** Resumo legível: "Enfermeiro(a) · UBS Centro; Gerente da UBS · UBS Centro". */
export function assignmentsSummary(a: Assignments, unitName: (id: string | null) => string): string {
  return [
    ...a.unitLinks.map((v) => `${OCCUPATIONS[v.occupation].label} · ${unitName(v.unitId)}`),
    ...a.roles.map((f) => `${ROLES[f.role].label}${f.unitId ? ` · ${unitName(f.unitId)}` : ""}`),
  ].join("; ");
}

/** Onde aparece o erro da unidade de uma linha do editor: o caminho do campo no schema. */
export const unitErrorKey = (list: "unitLinks" | "roles", index: number) => `${list}.${index}.unitId`;
