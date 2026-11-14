import { type Acao, condicoes, type Perfil, pode } from "@fila-saude/domain";
import type { PerfilDoUsuario } from "@/lib/navegacao";

const naUnidade = (perfis: PerfilDoUsuario[], unidadeId: string) =>
  perfis.filter((p) => p.unidadeId === null || p.unidadeId === unidadeId).map((p) => p.perfil);

/** Botões da fila do dia pela matriz, só com os perfis que valem na unidade (PD-38); a API confere de novo. */
export function acoesDaFila(perfis: PerfilDoUsuario[], unidadeId: string, estadoDaSessao: string) {
  const lista = naUnidade(perfis, unidadeId);
  const p = (a: Acao) => pode(lista, a);
  return {
    abrir: estadoDaSessao === "planejada" && p("abrir_cancelar_encerrar_sessao"),
    encerrar: estadoDaSessao === "aberta" && p("abrir_cancelar_encerrar_sessao"),
    presenca: estadoDaSessao === "aberta" && p("conferir_e_marcar_presenca"),
  };
}

const PESO: Record<string, number> = { chamado: 0, presente: 1, remoto: 2 };

/** Chamado, na unidade, remotos e depois quem já saiu; dentro de cada grupo, pela senha. */
export function ordenarFila<T extends { senha: string; estado: string }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => (PESO[a.estado] ?? 3) - (PESO[b.estado] ?? 3) || a.senha.localeCompare(b.senha));
}

const ROTULOS: Record<string, string> = {
  remoto: "A caminho",
  presente: "Na unidade",
  chamado: "Chamado",
  atendido_na_etapa: "Atendido",
  saiu_da_fila: "Saiu da fila",
  remanejado: "Remanejado",
};

export const rotuloDoEstado = (estado: string): string => ROTULOS[estado] ?? estado;

/** Tempo desde a chamada (a tolerância é só um contador, AD-006). */
export function cronometro(desde: string, agora: number): string {
  const s = Math.max(0, Math.floor((agora - Date.parse(desde)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const PENDENCIAS: Record<string, string> = {
  conta: "a conta",
  pessoa_atendida: "a pessoa atendida",
  pre_cadastro: "o pré-cadastro",
  prioridade: "a prioridade",
};

/** RN-FILA-05: o QR foi recusado e a recepção precisa conferir isto antes da presença. */
export function textoDasPendencias(pendencias: string[]): string | null {
  if (pendencias.length === 0) return null;
  return `Passe na recepção: conferir ${pendencias.map((p) => PENDENCIAS[p] ?? p).join(", ")}`;
}

/**
 * RN-PRES-03 / RN-FILA-05: a recepção marca a presença de qualquer remoto (sem app, não conseguiu ler
 * o QR); com pendência, confere os documentos na mesma ação e pode recusar ("não confere", com motivo).
 */
export function botoesDePresenca(
  item: { estado: string; pendencias: string[] },
  podePresenca: boolean,
): { marcar: string; naoConfere: boolean } | null {
  if (!podePresenca || item.estado !== "remoto") return null;
  const pendente = item.pendencias.length > 0;
  return { marcar: pendente ? "Conferir documentos e marcar presença" : "Marcar presença", naoConfere: pendente };
}

/** O que comparar com o documento: nascimento e CPF mascarado. */
export function textoDoDocumento(d: { nascimento: string; cpf: string | null }): string {
  const [a, m, dia] = d.nascimento.split("-");
  return `nasc. ${dia}/${m}/${a} · ${d.cpf ? `CPF ${d.cpf}` : "sem CPF"}`;
}

const ETAPA_DA_RESSALVA: Record<string, "triagem" | "atendimento"> = {
  "acolhimento na triagem": "triagem",
  atendimento: "atendimento",
};

/** PD-46: as estações da unidade que o perfil pode operar (a API recusaria as outras com 403). */
export function estacoesQueOpera<E extends { etapa: "triagem" | "atendimento" }>(
  estacoes: E[],
  perfis: { perfil: Perfil; unidadeId: string | null }[],
  unidadeId: string,
): E[] {
  const validos = perfis.filter((p) => p.unidadeId === null || p.unidadeId === unidadeId).map((p) => p.perfil);
  const c = condicoes(validos, "operar_chamadas");
  if (c === null) return [];
  if (c === "livre") return estacoes;
  const etapas = new Set(c.map((r) => ETAPA_DA_RESSALVA[r]));
  return estacoes.filter((e) => etapas.has(e.etapa));
}

type ItemComEstado = { senha: string; estado: string; pendencias: string[] };

/**
 * Fila do dia por situação, na ordem em que a equipe age: quem precisa da recepção, quem foi chamado,
 * quem está na unidade, quem está a caminho e, por último, quem já saiu. Dentro de cada grupo, pela senha.
 */
export function agruparFila<T extends ItemComEstado>(itens: T[]) {
  const porSenha = (l: T[]) => [...l].sort((a, b) => a.senha.localeCompare(b.senha));
  return {
    recepcao: porSenha(itens.filter((i) => i.estado === "remoto" && i.pendencias.length > 0)),
    chamados: porSenha(itens.filter((i) => i.estado === "chamado")),
    naUnidade: porSenha(itens.filter((i) => i.estado === "presente")),
    aCaminho: porSenha(itens.filter((i) => i.estado === "remoto" && i.pendencias.length === 0)),
    encerrados: porSenha(itens.filter((i) => !["remoto", "presente", "chamado"].includes(i.estado))),
  };
}

/** Números do topo da fila do dia. */
export function contadoresDaFila(itens: ItemComEstado[]) {
  return {
    naUnidade: itens.filter((i) => i.estado === "presente").length,
    aCaminho: itens.filter((i) => i.estado === "remoto").length,
    chamados: itens.filter((i) => i.estado === "chamado").length,
    atendidos: itens.filter((i) => i.estado === "atendido_na_etapa").length,
  };
}
