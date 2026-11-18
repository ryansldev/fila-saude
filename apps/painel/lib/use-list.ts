"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api-context";
import { errorMessage } from "@/lib/forms/errors";

/** Lista de um recurso da API, com recarga; `caminho` null = ainda não dá para buscar. */
export function useList<T>(path: string | null) {
  const api = useApi();
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const last = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versao` é o gatilho da recarga.
  useEffect(() => {
    // Outro caminho (outra unidade): nada da lista anterior fica na tela; recarga mantém.
    if (last.current !== path) {
      last.current = path;
      setItems([]);
      setError(null);
    }
    if (!path) return;
    let active = true;
    api
      .get<T[]>(path)
      .then((list) => {
        if (!active) return;
        setItems(list);
        setError(null);
      })
      .catch((e: unknown) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [api, path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { items, error, reload };
}
