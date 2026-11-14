import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { ErroDaApi } from "./api";
import { mensagemDoErro } from "./textos";
import { CPF_DA_CONTA } from "./validacao";

/**
 * Estados em que a entrada terminou: deixam a pessoa livre para se inscrever de novo no serviço.
 * Remanejada NÃO é final: a pessoa continua no serviço, esperando a unidade marcar outra data.
 */
const FINAIS = new Set(["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"]);

export const entradaAtiva = (e: Pick<MinhaEntrada, "estado">) => !FINAIS.has(e.estado);

/** RN-ID-07 (enxuto, mesmo número da API): uma conta inscreve até 5 pessoas por atendimento. */
export const MAX_POR_CONTA = 5;

/** AD-032: o dono da conta já tem uma entrada ativa neste serviço (então "para mim" não pode de novo). */
export function paraMimNoServico(minhas: MinhaEntrada[] | null, servicoId: string | undefined): boolean {
  if (!minhas || !servicoId) return false;
  return minhas.some((e) => e.paraMim && e.servicoId === servicoId && entradaAtiva(e));
}

export type InscricaoNaAgenda = { tipo: "livre" } | { tipo: "inscrito"; selo: string; podeOutra: boolean };

/** O selo da agenda diz como o dono está no serviço (nesta data, na lista, na reserva...). */
function seloDoDono(e: MinhaEntrada, sessaoId: string): string {
  if (e.estado === "remanejada") return "aguardando nova data";
  if (e.estado === "na_reserva") return "você está na reserva";
  if (e.estado === "aguardando" || !e.sessao) return "você está na lista de espera deste serviço";
  if (e.sessao.id === sessaoId) return "você já está inscrito";
  return "você já tem data neste serviço";
}

/**
 * Como a agenda mostra a sessão para a conta: "inscrito" quando o dono já está no serviço (nesta data
 * ou noutra). O cartão continua tocável para inscrever outra pessoa, até o limite da conta nesta data.
 * Sem "minhas" (carregando ou falhou), fica livre: a API ainda recusa a duplicada.
 */
export function inscricaoNaAgenda(
  sessao: { id: string; servico: { id: string } },
  minhas: MinhaEntrada[] | null,
): InscricaoNaAgenda {
  const ativas = (minhas ?? []).filter(entradaAtiva);
  const minha = ativas.find((e) => e.paraMim && e.servicoId === sessao.servico.id);
  if (!minha) return { tipo: "livre" };
  const nestaSessao = ativas.filter((e) => e.sessao?.id === sessao.id).length;
  return { tipo: "inscrito", selo: seloDoDono(minha, sessao.id), podeOutra: nestaSessao < MAX_POR_CONTA };
}

const normalizar = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mesmo nome, sem ligar para maiúsculas, acentos e espaços a mais. */
export function mesmoNome(a: string, b: string): boolean {
  const na = normalizar(a);
  return na !== "" && na === normalizar(b);
}

type Pessoa = { nome: string; nascimento: string; cpf?: string | null | undefined };
const digitos = (cpf: string | null | undefined) => (cpf ?? "").replace(/\D/g, "");

/** RN-LE-02 (como no domínio): mesmo CPF quando os dois têm; senão, mesmo nome e mesmo nascimento. */
export function mesmaPessoa(a: Pessoa, b: Pessoa): boolean {
  const ca = digitos(a.cpf);
  const cb = digitos(b.cpf);
  if (ca && cb) return ca === cb;
  return a.nascimento !== "" && a.nascimento === b.nascimento && mesmoNome(a.nome, b.nome);
}

/**
 * A conta já inscreveu esta "outra pessoa" no serviço: evita mandar a mesma pessoa duas vezes.
 * `pessoa.nascimento` é AAAA-MM-DD (vazio enquanto a data está incompleta: aí não acusa nada).
 * A lista "minhas" não traz o CPF de quem foi inscrito: a comparação fica em nome + nascimento.
 */
export function outraPessoaJaInscrita(minhas: MinhaEntrada[] | null, servicoId: string | undefined, pessoa: Pessoa) {
  if (!minhas || !servicoId || !pessoa.nascimento) return false;
  return minhas.some(
    (e) =>
      !e.paraMim &&
      e.servicoId === servicoId &&
      entradaAtiva(e) &&
      mesmaPessoa({ nome: e.pessoa, nascimento: e.nascimento }, pessoa),
  );
}

export type ErroDaVerificacao =
  | { tipo: "campo"; campo: "cpf"; texto: string }
  | { tipo: "pessoa"; texto: string }
  | { tipo: "faixa"; titulo: string; texto: string; saida: "agenda" | "fila" | null };

const PELA_SAIDA: Record<string, { titulo: string; texto?: string; saida: "agenda" | "fila" }> = {
  sessao_fechada: { titulo: "este atendimento não está aberto", saida: "agenda" },
  sessao_privada: { titulo: "este atendimento não está aberto", saida: "agenda" },
  limite_por_conta: { titulo: "limite de pessoas da conta", saida: "fila" },
  requisicao_pendente: { titulo: "falta o pedido médico", saida: "fila" },
  duplicada: { titulo: "já inscrito neste serviço", saida: "fila" },
};

/** Onde o passo "para quem" mostra a recusa do /verificar (a mesma que a inscrição daria). */
export function erroDaVerificacao(err: unknown): ErroDaVerificacao {
  const codigo = err instanceof ErroDaApi ? err.erro : "";
  if (codigo === "cpf_da_conta") return { tipo: "campo", campo: "cpf", texto: CPF_DA_CONTA };
  if (codigo === "pessoa_tem_conta")
    return {
      tipo: "campo",
      campo: "cpf",
      texto: "essa pessoa já tem conta no fila saúde. ela se inscreve pela própria conta.",
    };
  if (codigo === "cpf_invalido") return { tipo: "campo", campo: "cpf", texto: "CPF inválido. confira os números." };
  if (codigo === "pessoa_divergente")
    return {
      tipo: "pessoa",
      texto: "esse CPF já está cadastrado com outro nome ou outra data. confira os dados ou procure a recepção.",
    };
  const saida = PELA_SAIDA[codigo];
  if (saida) return { tipo: "faixa", titulo: saida.titulo, texto: mensagemDoErro(err), saida: saida.saida };
  return { tipo: "faixa", titulo: "não deu para conferir", texto: mensagemDoErro(err), saida: null };
}
