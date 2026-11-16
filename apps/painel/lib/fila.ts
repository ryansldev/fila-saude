import { type Acao, condicoes, instanteParaLocal, type Perfil, pode } from "@fila-saude/domain";
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

// ---------------------------------------------------------------------------------------------
// Fila do dia, caminho C (design system): a unidade inteira, com busca e pílulas por serviço.

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const soLetrasENumeros = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
const PARECE_SENHA = /^[a-z]{1,3}-?\d+$/i;

/**
 * Busca do balcão, na hora e sem ir à API: nome (sem acento nem maiúscula), senha (com ou sem hífen)
 * e CPF — com os 11 dígitos do documento, compara os 6 do meio, que é o que o CPF mascarado mostra.
 */
export function buscarNaFila<T extends { nome: string; senha: string; documento: { cpf: string | null } }>(
  itens: T[],
  termo: string,
): T[] {
  const t = termo.trim();
  if (!t) return itens;
  const digitos = t.replace(/\D/g, "");
  if (digitos.length === 11) {
    const meio = digitos.slice(3, 9);
    return itens.filter((i) => (i.documento.cpf ?? "").replace(/\D/g, "") === meio);
  }
  if (PARECE_SENHA.test(t)) {
    const senha = soLetrasENumeros(t);
    return itens.filter((i) => soLetrasENumeros(i.senha).includes(senha));
  }
  const nome = semAcento(t);
  return itens.filter((i) => semAcento(i.nome).includes(nome));
}

/** Minutos inteiros desde `iso` (para baixo; nunca negativo, se o relógio do servidor estiver adiantado). */
export function minutosDesde(iso: string, agora: number): number {
  return Math.max(0, Math.floor((agora - Date.parse(iso)) / 60_000));
}

export type ContextoDaLinha = { texto: string; tempo: string | null; tom: "neutro" | "alerta" | "chamado" };

/**
 * O que a linha diz da pessoa, em partes separadas (sem "Info · Info · Info"): a situação, há quanto
 * tempo (quando se sabe) e o tom. O serviço a linha mostra à parte.
 */
export function contextoDaLinha(
  i: { estado: string; etapa: string; pendencias: string[]; desde: string | null; estacao: string | null },
  agora: number,
): ContextoDaLinha {
  const tempo = i.desde ? `há ${minutosDesde(i.desde, agora)} min` : null;
  if (i.estado === "chamado")
    return { texto: i.estacao ? `chamado para ${i.estacao}` : "chamado", tempo, tom: "chamado" };
  if (i.estado === "presente")
    return { texto: i.etapa === "triagem" ? "esperando a triagem" : "esperando o atendimento", tempo, tom: "neutro" };
  if (i.estado === "remoto" && i.pendencias.length > 0)
    return { texto: `conferir ${i.pendencias.map((p) => PENDENCIAS[p] ?? p).join(", ")}`, tempo: null, tom: "alerta" };
  if (i.estado === "remoto") return { texto: "em casa", tempo: null, tom: "neutro" };
  return { texto: rotuloDoEstado(i.estado).toLowerCase(), tempo: null, tom: "neutro" };
}

/** A pílula de uma sessão de hoje: o serviço e, ao lado, quantos na fila ou quando abre. */
export function pilulaDaSessao(
  s: { servico: string; estado: string; inicio: string; contagens: { naFila: number } },
  fuso: string,
): { rotulo: string; detalhe: string; desativada: boolean } {
  const detalhe =
    s.estado === "planejada"
      ? `abre às ${instanteParaLocal(Date.parse(s.inicio), fuso).slice(11, 16)}`
      : s.estado === "encerrada"
        ? "encerrada"
        : s.estado === "cancelada"
          ? "cancelada"
          : String(s.contagens.naFila);
  return { rotulo: s.servico, detalhe, desativada: s.estado === "cancelada" };
}

/** O filtro guardado no navegador só vale se a sessão ainda está entre as de hoje; senão, "todas". */
export function filtroValido(guardado: string | null, sessoes: { id: string }[]): string {
  return guardado && sessoes.some((s) => s.id === guardado) ? guardado : "todas";
}
