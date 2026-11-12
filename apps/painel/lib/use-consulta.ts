"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";

/** Lê `caminho` e repete a cada `ms` (PD-33: tempo real por consulta até o SSE). `null` = não busca. */
export function useConsulta<T>(caminho: string | null, ms: number) {
  const api = useApi();
  const [dado, setDado] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versao` é o gatilho da recarga.
  useEffect(() => {
    setDado(null);
    if (!caminho) return;
    let ativo = true;
    const buscar = () =>
      api
        .get<T>(caminho)
        .then((d) => {
          if (!ativo) return;
          setDado(d);
          setErro(null);
        })
        .catch((e: unknown) => ativo && setErro(mensagemDoErro(e)));
    void buscar();
    const id = setInterval(buscar, ms);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [api, caminho, ms, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dado, erro, recarregar, setDado };
}
