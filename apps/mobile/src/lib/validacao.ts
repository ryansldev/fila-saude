import { nascimentoSchema, telefoneSchema } from "@fila-saude/schemas/auth";
import { cpfValido } from "@fila-saude/schemas/cpf";
import z from "zod";

/** "DD/MM/AAAA" → "AAAA-MM-DD"; vazio se incompleta ou se o dia não existe (31/02). */
export function dataIso(t: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  if (!m) return "";
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const r = nascimentoSchema.safeParse(iso);
  return r.success || r.error.issues.every((i) => i.message !== "nascimento_invalido") ? iso : "";
}

const MSG_NASCIMENTO: Record<string, string> = {
  nascimento_invalido: "data inválida. use dd/mm/aaaa.",
  nascimento_no_futuro: "a data não pode ser no futuro.",
  nascimento_antigo: "confira o ano de nascimento.",
};

function erroDoNascimento(t: string): string | null {
  const iso = dataIso(t);
  if (!iso) return MSG_NASCIMENTO.nascimento_invalido as string;
  const r = nascimentoSchema.safeParse(iso);
  return r.success
    ? null
    : (MSG_NASCIMENTO[r.error.issues[0]?.message ?? ""] ?? MSG_NASCIMENTO.nascimento_invalido ?? null);
}

const CPF_INVALIDO = "CPF inválido. confira os números.";

type Erros = Partial<Record<"nome" | "cpf" | "nascimento" | "telefone" | "email" | "senha", string>>;

function juntar(lista: [keyof Erros, string | null][]): Erros {
  const e: Erros = {};
  for (const [k, msg] of lista) if (msg) e[k] = msg;
  return e;
}

/** As mesmas regras da API (cadastroPacienteSchema), com mensagem por campo. */
export function erroDoCadastro(v: {
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string;
  email: string;
  senha: string;
}): Erros {
  return juntar([
    ["nome", v.nome.trim().length < 3 ? "escreva o nome completo." : null],
    ["cpf", cpfValido(v.cpf) ? null : CPF_INVALIDO],
    ["nascimento", erroDoNascimento(v.nascimento)],
    ["telefone", telefoneSchema.safeParse(v.telefone).success ? null : "celular com DDD, só números."],
    ["email", z.email().safeParse(v.email.trim()).success ? null : "e-mail inválido."],
    ["senha", v.senha.length < 8 ? "a senha precisa de pelo menos 8 caracteres." : null],
  ]);
}

/** "Outra pessoa" (AD-018): CPF opcional, mas válido quando preenchido. */
export function erroDaOutraPessoa(v: { nome: string; nascimento: string; cpf: string }): Erros {
  return juntar([
    ["nome", v.nome.trim().length < 3 ? "escreva o nome completo." : null],
    ["nascimento", erroDoNascimento(v.nascimento)],
    ["cpf", v.cpf.trim() === "" || cpfValido(v.cpf) ? null : CPF_INVALIDO],
  ]);
}
