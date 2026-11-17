"use client";

import { type ReactNode, useMemo } from "react";
import { createApi } from "@/lib/api";
import { ApiProvider } from "@/lib/api-context";
import { apiUrl } from "@/lib/tenant";

/** Cliente real da API no navegador (PD-24). No servidor a base fica vazia: chamadas só acontecem no cliente. */
export function ApiClientProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => {
    const base =
      typeof window === "undefined"
        ? ""
        : apiUrl(window.location, { NEXT_PUBLIC_API_PORT: process.env.NEXT_PUBLIC_API_PORT });
    return createApi(base, fetch, () => {
      // 401: volta ao login (fora da TV, que tem o próprio pareamento, e da própria tela de login).
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/tv")) window.location.replace("/login");
    });
  }, []);

  return <ApiProvider api={api}>{children}</ApiProvider>;
}
