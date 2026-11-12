import { type Acao, pode } from "@fila-saude/domain";
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
