import z from "zod";
import { cpfSchema } from "./cpf";
import { atribuicoesSchema, papelComEscopoSchema } from "./usuario.ts";

// "Hoje" no fuso do Brasil (AAAA-MM-DD), para a data de nascimento não ficar no futuro.
function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Telefone brasileiro com DDD: só dígitos depois de tirar a máscara, 10 (fixo) ou 11 (celular).
export const telefoneSchema = z
  .string()
  .transform((texto) => texto.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{10,11}$/, "telefone_invalido"));

const IDADE_MAXIMA = 130;

// Data real (o regex ISO do zod não confere o fim do mês), não no futuro e no máximo 130 anos atrás.
export const nascimentoSchema = z.iso
  .date("nascimento_invalido")
  .refine((data) => {
    const [a = 0, m = 0, d = 0] = data.split("-").map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "nascimento_invalido")
  .refine((data) => data <= hojeEmSaoPaulo(), "nascimento_no_futuro")
  .refine(
    (data) => Number(data.slice(0, 4)) >= Number(hojeEmSaoPaulo().slice(0, 4)) - IDADE_MAXIMA,
    "nascimento_antigo",
  );

// RN-ID-01 / RN-ID-04 / PD-23: corpo do `POST /v1/auth/sign-up/email`. O CPF sai só com dígitos.
export const cadastroPacienteSchema = z.object({
  cpf: cpfSchema,
  nome: z.string().trim().min(1).max(200),
  email: z.email(),
  telefone: telefoneSchema,
  nascimento: nascimentoSchema,
  senha: z.string().min(8).max(128),
});

export type CadastroPaciente = z.infer<typeof cadastroPacienteSchema>;

// PD-23 / RN-PERF-01: `GET /v1/painel/eu`: ocupações e funções, e os papéis de permissão que saem delas
// (`perfis`). O painel nunca tem o papel paciente.
export const euPainelSchema = atribuicoesSchema.extend({
  id: z.string(),
  nome: z.string(),
  login: z.string(),
  perfis: z.array(papelComEscopoSchema),
});

export type EuPainel = z.infer<typeof euPainelSchema>;
