import { erroDoCadastro } from "@/lib/validacao";

/** As telas do cadastro, uma pergunta por tela, e o resumo para conferir antes de criar a conta. */
export const PASSOS_DO_CADASTRO = ["nome", "cpf", "nascimento", "telefone", "senha", "email", "confira"] as const;
export type PassoDoCadastro = (typeof PASSOS_DO_CADASTRO)[number];
type CampoDoCadastro = Exclude<PassoDoCadastro, "confira">;

export type DadosDoCadastro = Record<CampoDoCadastro, string>;

/** O erro do campo desta tela (o "confira" não tem campo). */
export function erroDoPasso(p: PassoDoCadastro, v: DadosDoCadastro): string | undefined {
  if (p === "confira") return undefined;
  if (p === "cpf" && !v.cpf.replace(/\D/g, "")) return "digite o CPF.";
  return erroDoCadastro(v)[p];
}

/** "continuar": a próxima tela; quem veio de "corrigir" volta ao "confira". */
export function proximoPasso(p: PassoDoCadastro, corrigindo: boolean): PassoDoCadastro {
  if (corrigindo) return "confira";
  const i = PASSOS_DO_CADASTRO.indexOf(p);
  return PASSOS_DO_CADASTRO[Math.min(i + 1, PASSOS_DO_CADASTRO.length - 1)] ?? "confira";
}

/** "voltar": a tela anterior; na primeira, `null` (sai do cadastro). */
export function passoAnterior(p: PassoDoCadastro): PassoDoCadastro | null {
  const i = PASSOS_DO_CADASTRO.indexOf(p);
  return i > 0 ? (PASSOS_DO_CADASTRO[i - 1] ?? null) : null;
}

/** A regra da senha, marcada enquanto a pessoa digita. */
export const regraDaSenha = (senha: string) => ({ oitoCaracteres: senha.length >= 8 });

/** Recusa do servidor que é de um campo: a tela para onde voltar. */
export function passoDoErroDoServidor(codigo: string | undefined): "cpf" | "email" | null {
  if (codigo === "cpf_em_uso" || codigo === "cpf_invalido") return "cpf";
  if (codigo === "email_em_uso") return "email";
  return null;
}

const ROTULOS: Record<Exclude<CampoDoCadastro, "senha">, string> = {
  nome: "nome",
  cpf: "CPF",
  nascimento: "nascimento",
  telefone: "celular",
  email: "e-mail",
};

/** As linhas do "confira", na ordem das telas (a senha não aparece). */
export function resumoDoCadastro(v: DadosDoCadastro) {
  return (["nome", "cpf", "nascimento", "telefone", "email"] as const).map((passo) => ({
    passo,
    rotulo: ROTULOS[passo],
    valor: v[passo].trim(),
  }));
}
