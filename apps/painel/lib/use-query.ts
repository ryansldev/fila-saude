"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api-context";
import { errorMessage } from "@/lib/forms/errors";

/**
 * Lê `caminho` e repete a cada `ms` (PD-33: tempo real por consulta até o WebSocket). `null` = não busca.
 * - Trocar de caminho limpa o dado; recarregar não (a tela não pisca nem perde a seleção).
 * - A próxima consulta só sai `ms` depois da resposta anterior (nunca duas ao mesmo tempo).
 * - `setDetail` (resposta de uma ação) vence qualquer consulta que já estava no ar.
 */
export function useQuery<T>(path: string | null, ms: number) {
  const api = useApi();
  const [detail, setRawDetail] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const lastPath = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versao` é o gatilho da recarga.
  useEffect(() => {
    if (lastPath.current !== path) {
      lastPath.current = path;
      setRawDetail(null);
      setError(null);
    }
    if (!path) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetch = async () => {
      const my = generation.current;
      try {
        const d = await api.get<T>(path);
        if (active && my === generation.current) {
          setRawDetail(d);
          setError(null);
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
      if (active) timer = setTimeout(fetch, ms);
    };
    void fetch();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [api, path, ms, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setDetail = useCallback((d: T | null) => {
    generation.current++;
    setRawDetail(d);
  }, []);
  return { detail, error, reload, setDetail };
}
