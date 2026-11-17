// Quem é quem na unidade (discovery-papeis-ubs, RN-PERF-04). A ocupação é o que a pessoa é (alinhada ao
// CBO do vínculo no CNES); a função de gestão é o que ela administra; "agendar" é uma permissão ligável.
// As permissões saem daqui para os papéis da matriz (`permissoes.ts`).

import type { Profile } from "./permissions.ts";

export type Occupation =
  | "physician"
  | "nurse"
  | "nursing_technician"
  | "dentist"
  | "oral_health_assistant"
  | "community_health_agent"
  | "reception"
  | "pharmacist"
  | "psychologist"
  | "physiotherapist"
  | "nutritionist"
  | "social_worker";

export type Role = "sms_management" | "sms_regulation" | "unit_manager" | "scheduler";

export type UnitLink = { unitId: string; occupation: Occupation };
export type ScopedRole = { role: Role; unitId: string | null };
export type Assignments = { unitLinks: UnitLink[]; roles: ScopedRole[] };
export type ScopedProfile = { profile: Profile; unitId: string | null };

const CARE: Profile[] = ["care"];

export const OCCUPATIONS: Readonly<Record<Occupation, { label: string; roles: readonly Profile[] }>> = Object.freeze({
  physician: { label: "Médico(a)", roles: CARE },
  nurse: { label: "Enfermeiro(a)", roles: ["nurse"] },
  nursing_technician: { label: "Técnico(a) ou auxiliar de enfermagem", roles: ["nursing_technician"] },
  dentist: { label: "Cirurgião(ã)-dentista", roles: CARE },
  oral_health_assistant: { label: "Técnico(a) ou auxiliar em saúde bucal", roles: [] },
  community_health_agent: { label: "Agente comunitário de saúde", roles: [] },
  reception: { label: "Recepção / auxiliar administrativo", roles: ["reception"] },
  pharmacist: { label: "Farmacêutico(a)", roles: CARE },
  psychologist: { label: "Psicólogo(a)", roles: CARE },
  physiotherapist: { label: "Fisioterapeuta", roles: CARE },
  nutritionist: { label: "Nutricionista", roles: CARE },
  social_worker: { label: "Assistente social", roles: CARE },
});

export const ROLES: Readonly<Record<Role, { label: string; scope: "municipality" | "unit"; management: boolean }>> =
  Object.freeze({
    sms_management: { label: "Gestão municipal (SMS)", scope: "municipality", management: true },
    sms_regulation: { label: "Regulação (SMS)", scope: "municipality", management: true },
    unit_manager: { label: "Gerente da UBS", scope: "unit", management: true },
    scheduler: { label: "Agendar pacientes da lista de espera", scope: "unit", management: false },
  });

/** Papéis de permissão de quem tem estas atribuições, cada um com o seu escopo. */
export function rolesOf(a: Assignments): ScopedProfile[] {
  return [
    ...a.unitLinks.flatMap((v) => OCCUPATIONS[v.occupation].roles.map((profile) => ({ profile, unitId: v.unitId }))),
    ...a.roles.map((f) => ({ profile: f.role as Profile, unitId: f.unitId })),
  ];
}

/** Erros de forma: ao menos uma atribuição; função do município sem unidade, da unidade com unidade. */
export function staffProblems(a: Assignments): Record<string, string> {
  if (a.unitLinks.length === 0 && a.roles.length === 0) return { _: "Informe ao menos uma ocupação ou função." };
  const errors: Record<string, string> = {};
  a.roles.forEach((f, i) => {
    const fromMunicipality = ROLES[f.role].scope === "municipality";
    if (fromMunicipality && f.unitId !== null) errors[`funcoes.${i}.unidadeId`] = "Função do município, sem unidade.";
    if (!fromMunicipality && f.unitId === null) errors[`funcoes.${i}.unidadeId`] = "Escolha a unidade.";
  });
  return errors;
}

/**
 * RN-PERF-04: quem cadastra quem. A gestão SMS cadastra qualquer pessoa. O gerente da UBS cadastra só quem
 * fica inteiramente nas unidades que ele gerencia e só concede "agendar" (nenhuma função de gestão).
 * Os outros não cadastram ninguém.
 */
export function canRegister(actor: Assignments, target: Assignments): boolean {
  if (actor.roles.some((f) => f.role === "sms_management")) return true;
  const manages = new Set(actor.roles.filter((f) => f.role === "unit_manager").map((f) => f.unitId));
  if (manages.size === 0) return false;
  return (
    target.unitLinks.every((v) => manages.has(v.unitId)) &&
    target.roles.every((f) => !ROLES[f.role].management && manages.has(f.unitId))
  );
}
