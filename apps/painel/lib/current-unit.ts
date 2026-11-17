"use client";

import { type Action, can, instantToLocal, type Profile } from "@fila-saude/domain";
import type { StaffMe } from "@fila-saude/schemas/auth";
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
import { errorMessage } from "@/lib/forms/errors";
import { useMe } from "@/lib/session";

/** A unidade como a lista do painel devolve (o que a troca de unidade e a tela do paciente mostram). */
export type UnitSummary = {
  id: string;
  name: string;
  timeZone: string;
  kind?: "ubs" | "polyclinic" | "upa";
  cnes?: string | null;
  address?: { street: string; number: string; neighborhood: string; postalCode: string; complement?: string | null };
};

const KEY = "fila-painel:unidade-atual";

/** Gestor (escopo município) vê todas; os outros, as unidades dos seus perfis. */
export function userUnits(me: StaffMe): { all: boolean; ids: string[] } {
  if (me.profiles.some((p) => p.unitId === null)) return { all: true, ids: [] };
  return { all: false, ids: [...new Set(me.profiles.map((p) => p.unitId as string))] };
}

/** Só as unidades em que os perfis podem alguma das ações da página (as outras dariam 403 em tudo). */
export function unitsForAction<U extends { id: string }>(
  units: U[],
  profiles: { profile: Profile; unitId: string | null }[],
  actions: Action[],
): U[] {
  return units.filter((u) => {
    const there = profiles.filter((p) => p.unitId === null || p.unitId === u.id).map((p) => p.profile);
    return actions.some((a) => can(there, a));
  });
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function store(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Sem armazenamento a escolha vale só nesta página.
  }
}

/** A unidade escolhida no começo: a guardada, se a pessoa ainda a vê; senão, a primeira; sem unidades, nenhuma. */
export function initialUnit(stored: string | null, ids: string[]): string | null {
  if (stored && ids.includes(stored)) return stored;
  return ids[0] ?? null;
}

type UnitState = {
  all: UnitSummary[];
  current: string | null;
  choose: (id: string) => void;
  error: string | null;
  loaded: boolean;
};

const UnitContext = createContext<UnitState | null>(null);

/** Lista as unidades da pessoa e guarda a escolhida (no navegador). `fetch` desliga quando já há provedor. */
function useUnitState(fetch: boolean): UnitState {
  const api = useApi();
  const [all, setAll] = useState<UnitSummary[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!fetch) return;
    let active = true;
    api
      .get<UnitSummary[]>("/v1/panel/units")
      .then((list) => {
        if (!active) return;
        setAll(list);
        setError(null);
        setLoaded(true);
      })
      .catch((e) => {
        if (!active) return;
        setAll([]);
        // Antes um erro virava "nenhuma unidade disponível".
        setError(errorMessage(e));
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [api, fetch]);

  useEffect(() => {
    if (!loaded) return;
    const ids = all.map((u) => u.id);
    if (current && ids.includes(current)) return;
    setCurrent(initialUnit(readStored(), ids));
  }, [all, current, loaded]);

  const choose = useCallback((id: string) => {
    setCurrent(id);
    store(id);
  }, []);

  return { all, current, choose, error, loaded };
}

/** Provedor da unidade do painel inteiro (layout): o cartão do menu troca, as páginas leem. */
export function UnitProvider({ children }: { children: ReactNode }) {
  const state = useUnitState(true);
  return createElement(UnitContext.Provider, { value: state }, children);
}

/** A unidade escolhida no painel, sem filtro de ação (o cartão do menu, a troca de unidade). */
export function usePanelUnit(): UnitState & { unit: UnitSummary | null } {
  const ctx = useContext(UnitContext);
  const own = useUnitState(ctx === null);
  const e = ctx ?? own;
  return { ...e, unit: e.all.find((u) => u.id === e.current) ?? null };
}

/**
 * Unidade em que a página trabalha: a escolhida no menu, se a pessoa pode as ações da página nela
 * (senão, nenhuma). Fora do layout do painel (tela do paciente), busca sozinha.
 */
export function useCurrentUnit(actions?: Action[]) {
  const me = useMe();
  const { all, current: chosen, choose, error } = usePanelUnit();
  const actionKey = actions?.join(",") ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `actionKey` representa `actions`.
  const units = useMemo(() => {
    if (!actions) return all;
    if (me.state !== "authenticated") return [];
    return unitsForAction(all, me.me.profiles, actions);
  }, [all, me, actionKey]);
  const current = chosen && units.some((u) => u.id === chosen) ? chosen : null;
  return { units, current, choose, error, unit: units.find((u) => u.id === current) ?? null };
}

/** O que acontece hoje na unidade, em palavras (troca de unidade); sem resumo ainda, nada. */
export function summaryText(
  r: { open: number; nextOpening: string | null } | undefined,
  timeZone: string,
): string | null {
  if (!r) return null;
  if (r.open > 0) return r.open === 1 ? "1 sessão aberta" : `${r.open} sessões abertas`;
  if (r.nextOpening) return `abre às ${instantToLocal(Date.parse(r.nextOpening), timeZone).slice(11, 16)}`;
  return "nada hoje";
}

/** O endereço em linhas (rua e número, bairro, CEP), para cada informação ficar no seu lugar. */
export function addressRows(e: {
  street: string;
  number: string;
  neighborhood: string;
  postalCode: string;
  complement?: string | null;
}): string[] {
  const d = e.postalCode.replace(/\D/g, "");
  const postalCode = d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : e.postalCode;
  return [`${e.street}, ${e.number}${e.complement ? ` (${e.complement})` : ""}`, e.neighborhood, `CEP ${postalCode}`];
}
