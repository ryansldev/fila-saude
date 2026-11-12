"use client";

import type { EuPainel } from "@fila-saude/schemas/auth";
import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/lib/api-context";

export type UnidadeResumo = { id: string; nome: string; fuso: string };

const CHAVE = "fila-painel:unidade-atual";

/** Gestor (escopo município) vê todas; os outros, as unidades dos seus perfis. */
export function unidadesDoUsuario(eu: EuPainel): { todas: boolean; ids: string[] } {
  if (eu.perfis.some((p) => p.unidadeId === null)) return { todas: true, ids: [] };
  return { todas: false, ids: [...new Set(eu.perfis.map((p) => p.unidadeId as string))] };
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
export function useUnidadeAtual() {
  const api = useApi();
  const [unidades, setUnidades] = useState<UnidadeResumo[]>([]);
  const [atual, setAtual] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<UnidadeResumo[]>("/v1/painel/unidades")
      .then((lista) => {
        if (!ativo) return;
        setUnidades(lista);
        const guardada = lerGuardada();
        if (lista.length === 1) setAtual(lista[0]?.id ?? null);
        else if (guardada && lista.some((u) => u.id === guardada)) setAtual(guardada);
      })
      .catch(() => ativo && setUnidades([]));
    return () => {
      ativo = false;
    };
  }, [api]);

  const escolher = useCallback((id: string) => {
    setAtual(id);
    guardar(id);
  }, []);

  return { unidades, atual, escolher, unidade: unidades.find((u) => u.id === atual) ?? null };
}
