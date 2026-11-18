"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { Api } from "@/lib/api";

const ApiContext = createContext<Api | null>(null);

/** Injeta o cliente da API (PD-31): o real no app, um falso nos testes. */
export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiContext value={api}>{children}</ApiContext>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi precisa estar dentro de um <ApiProvider>");
  return api;
}
