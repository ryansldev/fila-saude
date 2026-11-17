import z from "zod";
import { cpfSchema } from "./cpf";
import { assignmentsSchema, scopedProfileSchema } from "./user.ts";

// "Hoje" no fuso do Brasil (AAAA-MM-DD), para a data de nascimento não ficar no futuro.
function todaySaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Telefone brasileiro com DDD: só dígitos depois de tirar a máscara, 10 (fixo) ou 11 (celular).
export const phoneSchema = z
  .string()
  .transform((text) => text.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{10,11}$/, "invalid_phone"));

const MAXIMUM_AGE = 130;

// Data real (o regex ISO do zod não confere o fim do mês), não no futuro e no máximo 130 anos atrás.
export const birthDateSchema = z.iso
  .date("invalid_birth_date")
  .refine((data) => {
    const [a = 0, m = 0, d = 0] = data.split("-").map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "invalid_birth_date")
  .refine((data) => data <= todaySaoPaulo(), "birth_date_in_future")
  .refine(
    (data) => Number(data.slice(0, 4)) >= Number(todaySaoPaulo().slice(0, 4)) - MAXIMUM_AGE,
    "birth_date_too_old",
  );

// RN-ID-01 / RN-ID-04 / PD-23: corpo do `POST /v1/auth/sign-up/email`. O CPF sai só com dígitos.
export const patientRegistrationSchema = z.object({
  cpf: cpfSchema,
  name: z.string().trim().min(1).max(200),
  email: z.email(),
  phone: phoneSchema,
  birthDate: birthDateSchema,
  password: z.string().min(8).max(128),
});

export type PatientRegistration = z.infer<typeof patientRegistrationSchema>;

// PD-23 / RN-PERF-01: `GET /v1/painel/eu`: ocupações e funções, e os papéis de permissão que saem delas
// (`perfis`). O painel nunca tem o papel paciente.
export const staffMeSchema = assignmentsSchema.extend({
  id: z.string(),
  name: z.string(),
  login: z.string(),
  profiles: z.array(scopedProfileSchema),
});

export type StaffMe = z.infer<typeof staffMeSchema>;
