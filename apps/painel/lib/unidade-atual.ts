"use client";

import { type Acao, instanteParaLocal, type Perfil, pode } from "@fila-saude/domain";
import type { EuPainel } from "@fila-saude/schemas/auth";
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useEu } from "@/lib/sessao";

/** A unidade como a lista do painel devolve (o que a troca de unidade e a tela do paciente mostram). */
export type UnidadeResumo = {
  id: string;
  nome: string;
  fuso: string;
  tipo?: "ubs" | "policlinica" | "upa";
  cnes?: string | null;
  endereco?: { logradouro: string; numero: string; bairro: string; cep: string; complemento?: string | null };
};

const CHAVE = "fila-painel:unidade-atual";

/** Gestor (escopo município) vê todas; os outros, as unidades dos seus perfis. */
export function unidadesDoUsuario(eu: EuPainel): { todas: boolean; ids: string[] } {
  if (eu.perfis.some((p) => p.unidadeId === null)) return { todas: true, ids: [] };
  return { todas: false, ids: [...new Set(eu.perfis.map((p) => p.unidadeId as string))] };
}

/** Só as unidades em que os perfis podem alguma das ações da página (as outras dariam 403 em tudo). */
export function unidadesParaAcao<U extends { id: string }>(
  unidades: U[],
  perfis: { perfil: Perfil; unidadeId: string | null }[],
  acoes: Acao[],
): U[] {
  return unidades.filter((u) => {
    const ali = perfis.filter((p) => p.unidadeId === null || p.unidadeId === u.id).map((p) => p.perfil);
    return acoes.some((a) => pode(ali, a));
  });
}

function lerGuardada(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function guardar(id: string) {
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // Sem armazenamento a escolha vale só nesta página.
  }
}

/** A unidade escolhida no começo: a guardada, se a pessoa ainda a vê; senão, a primeira; sem unidades, nenhuma. */
export function unidadeInicial(guardada: string | null, ids: string[]): string | null {
  if (guardada && ids.includes(guardada)) return guardada;
  return ids[0] ?? null;
}

type EstadoDaUnidade = {
  todas: UnidadeResumo[];
  atual: string | null;
  escolher: (id: string) => void;
  erro: string | null;
  carregou: boolean;
};

const ContextoDaUnidade = createContext<EstadoDaUnidade | null>(null);

/** Lista as unidades da pessoa e guarda a escolhida (no navegador). `buscar` desliga quando já há provedor. */
function useEstadoDaUnidade(buscar: boolean): EstadoDaUnidade {
  const api = useApi();
  const [todas, setTodas] = useState<UnidadeResumo[]>([]);
  const [atual, setAtual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    if (!buscar) return;
    let ativo = true;
    api
      .get<UnidadeResumo[]>("/v1/painel/unidades")
      .then((lista) => {
        if (!ativo) return;
        setTodas(lista);
        setErro(null);
        setCarregou(true);
      })
      .catch((e) => {
        if (!ativo) return;
        setTodas([]);
        // Antes um erro virava "nenhuma unidade disponível".
        setErro(mensagemDoErro(e));
        setCarregou(true);
      });
    return () => {
      ativo = false;
    };
  }, [api, buscar]);

  useEffect(() => {
    if (!carregou) return;
    const ids = todas.map((u) => u.id);
    if (atual && ids.includes(atual)) return;
    setAtual(unidadeInicial(lerGuardada(), ids));
  }, [todas, atual, carregou]);

  const escolher = useCallback((id: string) => {
    setAtual(id);
    guardar(id);
  }, []);

  return { todas, atual, escolher, erro, carregou };
}

/** Provedor da unidade do painel inteiro (layout): o cartão do menu troca, as páginas leem. */
export function ProvedorDaUnidade({ children }: { children: ReactNode }) {
  const estado = useEstadoDaUnidade(true);
  return createElement(ContextoDaUnidade.Provider, { value: estado }, children);
}

/** A unidade escolhida no painel, sem filtro de ação (o cartão do menu, a troca de unidade). */
export function useUnidadeDoPainel(): EstadoDaUnidade & { unidade: UnidadeResumo | null } {
  const ctx = useContext(ContextoDaUnidade);
  const proprio = useEstadoDaUnidade(ctx === null);
  const e = ctx ?? proprio;
  return { ...e, unidade: e.todas.find((u) => u.id === e.atual) ?? null };
}

/**
 * Unidade em que a página trabalha: a escolhida no menu, se a pessoa pode as ações da página nela
 * (senão, nenhuma). Fora do layout do painel (tela do paciente), busca sozinha.
 */
export function useUnidadeAtual(acoes?: Acao[]) {
  const eu = useEu();
  const { todas, atual: escolhida, escolher, erro } = useUnidadeDoPainel();
  const chaveAcoes = acoes?.join(",") ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `chaveAcoes` representa `acoes`.
  const unidades = useMemo(() => {
    if (!acoes) return todas;
    if (eu.estado !== "autenticado") return [];
    return unidadesParaAcao(todas, eu.eu.perfis, acoes);
  }, [todas, eu, chaveAcoes]);
  const atual = escolhida && unidades.some((u) => u.id === escolhida) ? escolhida : null;
  return { unidades, atual, escolher, erro, unidade: unidades.find((u) => u.id === atual) ?? null };
}

/** O que acontece hoje na unidade, em palavras (troca de unidade); sem resumo ainda, nada. */
export function textoDoResumo(
  r: { abertas: number; proximaAbertura: string | null } | undefined,
  fuso: string,
): string | null {
  if (!r) return null;
  if (r.abertas > 0) return r.abertas === 1 ? "1 sessão aberta" : `${r.abertas} sessões abertas`;
  if (r.proximaAbertura) return `abre às ${instanteParaLocal(Date.parse(r.proximaAbertura), fuso).slice(11, 16)}`;
  return "nada hoje";
}

/** O endereço em linhas (rua e número, bairro, CEP), para cada informação ficar no seu lugar. */
export function linhasDoEndereco(e: {
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  complemento?: string | null;
}): string[] {
  const d = e.cep.replace(/\D/g, "");
  const cep = d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : e.cep;
  return [`${e.logradouro}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ""}`, e.bairro, `CEP ${cep}`];
}
