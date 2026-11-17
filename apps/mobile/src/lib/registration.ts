import { registrationError } from "@/lib/validation";

/** As telas do cadastro, uma pergunta por tela, e o resumo para conferir antes de criar a conta. */
export const REGISTRATION_STEPS = ["name", "cpf", "birthDate", "phone", "password", "email", "review"] as const;
export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];
type RegistrationField = Exclude<RegistrationStep, "review">;

export type RegistrationData = Record<RegistrationField, string>;

/** O erro do campo desta tela (o "confira" não tem campo). */
export function stepError(p: RegistrationStep, v: RegistrationData): string | undefined {
  if (p === "review") return undefined;
  if (p === "cpf" && !v.cpf.replace(/\D/g, "")) return "digite o CPF.";
  return registrationError(v)[p];
}

/** "continuar": a próxima tela; quem veio de "corrigir" volta ao "confira". */
export function nextStep(p: RegistrationStep, fixing: boolean): RegistrationStep {
  if (fixing) return "review";
  const i = REGISTRATION_STEPS.indexOf(p);
  return REGISTRATION_STEPS[Math.min(i + 1, REGISTRATION_STEPS.length - 1)] ?? "review";
}

/** "voltar": a tela anterior; na primeira, `null` (sai do cadastro). */
export function previousStep(p: RegistrationStep): RegistrationStep | null {
  const i = REGISTRATION_STEPS.indexOf(p);
  return i > 0 ? (REGISTRATION_STEPS[i - 1] ?? null) : null;
}

/** A regra da senha, marcada enquanto a pessoa digita. */
export const passwordRule = (password: string) => ({ eightCharacters: password.length >= 8 });

/** Recusa do servidor que é de um campo: a tela para onde voltar. */
export function serverErrorStep(code: string | undefined): "cpf" | "email" | null {
  if (code === "cpf_in_use" || code === "invalid_cpf") return "cpf";
  if (code === "email_in_use") return "email";
  return null;
}

const LABELS: Record<Exclude<RegistrationField, "password">, string> = {
  name: "nome",
  cpf: "CPF",
  birthDate: "nascimento",
  phone: "celular",
  email: "e-mail",
};

/** As linhas do "confira", na ordem das telas (a senha não aparece). */
export function registrationSummary(v: RegistrationData) {
  return (["name", "cpf", "birthDate", "phone", "email"] as const).map((step) => ({
    step,
    label: LABELS[step],
    value: v[step].trim(),
  }));
}
