import { birthDateSchema, phoneSchema } from "@fila-saude/schemas/auth";
import { validCpf } from "@fila-saude/schemas/cpf";
import z from "zod";

/** "DD/MM/AAAA" → "AAAA-MM-DD"; vazio se incompleta ou se o dia não existe (31/02). */
export function dataIso(t: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  if (!m) return "";
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const r = birthDateSchema.safeParse(iso);
  return r.success || r.error.issues.every((i) => i.message !== "invalid_birth_date") ? iso : "";
}

const MSG_BIRTH_DATE: Record<string, string> = {
  invalid_birth_date: "data inválida. use dd/mm/aaaa.",
  birth_date_in_future: "a data não pode ser no futuro.",
  birth_date_too_old: "confira o ano de nascimento.",
};

function birthDateError(t: string): string | null {
  const iso = dataIso(t);
  if (!iso) return MSG_BIRTH_DATE.invalid_birth_date as string;
  const r = birthDateSchema.safeParse(iso);
  return r.success
    ? null
    : (MSG_BIRTH_DATE[r.error.issues[0]?.message ?? ""] ?? MSG_BIRTH_DATE.invalid_birth_date ?? null);
}

const INVALID_CPF = "CPF inválido. confira os números.";

type Errors = Partial<Record<"name" | "cpf" | "birthDate" | "phone" | "email" | "password", string>>;

function merge(list: [keyof Errors, string | null][]): Errors {
  const e: Errors = {};
  for (const [k, msg] of list) if (msg) e[k] = msg;
  return e;
}

/** As mesmas regras da API (cadastroPacienteSchema), com mensagem por campo. */
export function registrationError(v: {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string;
  password: string;
}): Errors {
  return merge([
    ["name", v.name.trim().length < 3 ? "escreva o nome completo." : null],
    ["cpf", validCpf(v.cpf) ? null : INVALID_CPF],
    ["birthDate", birthDateError(v.birthDate)],
    ["phone", phoneSchema.safeParse(v.phone).success ? null : "celular com DDD, só números."],
    ["email", z.email().safeParse(v.email.trim()).success ? null : "e-mail inválido."],
    ["password", v.password.length < 8 ? "a senha precisa de pelo menos 8 caracteres." : null],
  ]);
}

export const ACCOUNT_CPF = 'esse é o seu CPF. para você, escolha "para mim".';

const digits = (t: string) => t.replace(/\D/g, "");

/** "Outra pessoa" (AD-018): CPF opcional, mas válido quando preenchido e nunca o do dono da conta. */
export function otherPersonError(
  v: { name: string; birthDate: string; cpf: string },
  accountCpf?: string | undefined,
): Errors {
  const cpf =
    v.cpf.trim() === ""
      ? null
      : !validCpf(v.cpf)
        ? INVALID_CPF
        : accountCpf && digits(accountCpf) === digits(v.cpf)
          ? ACCOUNT_CPF
          : null;
  return merge([
    ["name", v.name.trim().length < 3 ? "escreva o nome completo." : null],
    ["birthDate", birthDateError(v.birthDate)],
    ["cpf", cpf],
  ]);
}

/** Entrar: o que falta em cada campo, dito no próprio campo (o botão fica sempre aceso). */
export function missingInLogin(cpf: string, password: string): { cpf?: string; password?: string } {
  const r: { cpf?: string; password?: string } = {};
  if (!cpf.replace(/\D/g, "")) r.cpf = "digite o CPF.";
  else if (!validCpf(cpf)) r.cpf = "CPF inválido. confira os números.";
  if (!password) r.password = "digite a senha.";
  return r;
}
