"use client";

import { type ReactNode, useMemo } from "react";
import { criarApi } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { urlDaApi } from "@/lib/tenant";

/** Cliente real da API no navegador (PD-24). No servidor a base fica vazia: chamadas só acontecem no cliente. */
export function ProvedorApi({ children }: { children: ReactNode }) {
  const api = useMemo(() => {
    const base =
      typeof window === "undefined"
        ? ""
        : urlDaApi(window.location, { NEXT_PUBLIC_API_PORTA: process.env.NEXT_PUBLIC_API_PORTA });
    return criarApi(base, fetch, () => {
      // 401: volta ao login (fora da TV, que tem o próprio pareamento, e da própria tela de login).
      const caminho = window.location.pathname;
      if (!caminho.startsWith("/login") && !caminho.startsWith("/tv")) window.location.replace("/login");
    });
  }, []);

  return <ApiProvider api={api}>{children}</ApiProvider>;
}
