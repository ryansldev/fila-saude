import { idadeEm } from "./tempo.ts";
import type { GrupoDeclarado } from "./tipos.ts";

/** Grupos de prioridade legal (RN-RISCO-04, AD-025). Lista fixa no código no MVP. */
export type Grupo =
  | "idoso"
  | "idoso80"
  | "gestante"
  | "lactante"
  | "colo"
  | "pcd"
  | "tea"
  | "mobilidade"
  | "doador"
  | "obesidade";

type Conferencia = "visual" | "documento" | "nascimento" | "a_definir";

/**
 * Como cada grupo é conferido na recepção e por quantos dias a conferência vale.
 * TODO(D5): prazo de gestante, lactante e criança de colo ainda a definir; `null` = sem prazo até lá.
 */
export const GRUPOS: Record<Grupo, { conferencia: Conferencia; expiraEmDias: number | null }> = {
  idoso: { conferencia: "nascimento", expiraEmDias: null },
  idoso80: { conferencia: "nascimento", expiraEmDias: null },
  gestante: { conferencia: "visual", expiraEmDias: null },
  colo: { conferencia: "visual", expiraEmDias: null },
  pcd: { conferencia: "documento", expiraEmDias: null },
  tea: { conferencia: "documento", expiraEmDias: null },
  lactante: { conferencia: "a_definir", expiraEmDias: null },
  mobilidade: { conferencia: "a_definir", expiraEmDias: null },
  doador: { conferencia: "a_definir", expiraEmDias: null },
  obesidade: { conferencia: "a_definir", expiraEmDias: null },
};

export type PrioridadeLegal = {
  grupos: Grupo[];
  conferida: boolean;
  conferidaEm: number | null;
};

const DIA_MS = 86_400_000;

const DE_DECLARADO: Record<GrupoDeclarado, Grupo> = {
  gestante: "gestante",
  lactante: "lactante",
  crianca_de_colo: "colo",
  pcd: "pcd",
  tea: "tea",
  mobilidade_reduzida: "mobilidade",
  doador_de_sangue: "doador",
  obesidade: "obesidade",
};

/** Traduz a resposta da Tela 5 para o grupo do domínio. */
export function grupoDeDeclarado(declarado: GrupoDeclarado): Grupo {
  return DE_DECLARADO[declarado];
}

/**
 * Grupos da pessoa atendida (AD-027): idoso e idoso80 vêm só da data de nascimento;
 * os declarados (inclusive criança de colo) são mantidos; nada do acompanhante entra.
 */
export function prioridadeDaPessoa(
  pessoa: { nascimento: string },
  declarados: Grupo[],
  agora: number,
  fuso: string,
): Grupo[] {
  const idade = idadeEm(pessoa.nascimento, agora, fuso);
  const grupos: Grupo[] = [];
  if (idade >= 80) grupos.push("idoso80");
  else if (idade >= 60) grupos.push("idoso");
  for (const g of declarados) {
    if (g === "idoso" || g === "idoso80" || grupos.includes(g)) continue;
    grupos.push(g);
  }
  return grupos;
}

/** Onde a recepção está ao tentar dar prioridade legal (RN-RISCO-04, matriz de permissões). */
export type ContextoDarPrioridade = "inclusao_balcao" | "primeira_presenca_sem_app" | "ja_na_fila";

/** Dar prioridade só na inclusão pelo balcão ou na 1ª presença de paciente sem app; na fila, só conferir ou tirar. */
export function podeDarPrioridade(contexto: ContextoDarPrioridade): boolean {
  return contexto === "inclusao_balcao" || contexto === "primeira_presenca_sem_app";
}

/** Declarada vale até a conferência (AD-024/050). */
export function temPrioridade(p: PrioridadeLegal): boolean {
  return p.grupos.length > 0;
}

/** 2 = 80+, 1 = qualquer outro grupo (sem hierarquia entre eles), 0 = nenhum. */
export function rankPrioridade(p: PrioridadeLegal): 0 | 1 | 2 {
  if (p.grupos.includes("idoso80")) return 2;
  return p.grupos.length > 0 ? 1 : 0;
}

/**
 * Conferida há `expiraEmDias` ou mais dias: expira e volta a ser conferida.
 * `prazos` permite sobrepor os padrões de GRUPOS (configuração, D5).
 */
export function expirada(
  p: PrioridadeLegal,
  agora: number,
  prazos: Partial<Record<Grupo, number | null>> = {},
): boolean {
  if (!p.conferida || p.conferidaEm === null) return false;
  const conferidaEm = p.conferidaEm;
  return p.grupos.some((g) => {
    const dias = prazos[g] ?? GRUPOS[g].expiraEmDias;
    return dias !== null && agora - conferidaEm >= dias * DIA_MS;
  });
}
