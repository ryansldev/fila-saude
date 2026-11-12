"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";

/** Lista de um recurso da API, com recarga; `caminho` null = ainda não dá para buscar. */
export function useLista<T>(caminho: string | null) {
  const api = useApi();
  const [itens, setItens] = useState<T[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versao` é o gatilho da recarga.
  useEffect(() => {
    if (!caminho) {
      setItens([]);
      return;
    }
    let ativo = true;
    api
      .get<T[]>(caminho)
      .then((lista) => {
        if (!ativo) return;
        setItens(lista);
        setErro(null);
      })
      .catch((e: unknown) => ativo && setErro(mensagemDoErro(e)));
    return () => {
      ativo = false;
    };
  }, [api, caminho, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { itens, erro, recarregar };
}
