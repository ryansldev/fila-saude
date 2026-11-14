"use client";

import { type Acao, type Perfil, pode } from "@fila-saude/domain";
import type { EuPainel } from "@fila-saude/schemas/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useEu } from "@/lib/sessao";

export type UnidadeResumo = { id: string; nome: string; fuso: string };

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

/** Unidade em que o usuário está trabalhando: com uma só, já vem escolhida. */
export function useUnidadeAtual(acoes?: Acao[]) {
  const api = useApi();
  const eu = useEu();
  const [todas, setTodas] = useState<UnidadeResumo[]>([]);
  const [atual, setAtual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const chaveAcoes = acoes?.join(",") ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `chaveAcoes` representa `acoes`.
  const unidades = useMemo(() => {
    if (!acoes) return todas;
    if (eu.estado !== "autenticado") return [];
    return unidadesParaAcao(todas, eu.eu.perfis, acoes);
  }, [todas, eu, chaveAcoes]);

  useEffect(() => {
    let ativo = true;
    api
      .get<UnidadeResumo[]>("/v1/painel/unidades")
      .then((lista) => {
        if (!ativo) return;
        setTodas(lista);
        setErro(null);
      })
      .catch((e) => {
        if (!ativo) return;
        setTodas([]);
        // Antes um erro virava "nenhuma unidade disponível".
        setErro(mensagemDoErro(e));
      });
    return () => {
      ativo = false;
    };
  }, [api]);

  // Escolha automática sobre a lista já filtrada pela ação da página.
  useEffect(() => {
    if (atual && unidades.some((u) => u.id === atual)) return;
    const guardada = lerGuardada();
    if (unidades.length === 1) setAtual(unidades[0]?.id ?? null);
    else if (guardada && unidades.some((u) => u.id === guardada)) setAtual(guardada);
    else setAtual(null);
  }, [unidades, atual]);

  const escolher = useCallback((id: string) => {
    setAtual(id);
    guardar(id);
  }, []);

  return { unidades, atual, escolher, erro, unidade: unidades.find((u) => u.id === atual) ?? null };
}
