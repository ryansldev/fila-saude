"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";

/**
 * Lê `caminho` e repete a cada `ms` (PD-33: tempo real por consulta até o SSE). `null` = não busca.
 * - Trocar de caminho limpa o dado; recarregar não (a tela não pisca nem perde a seleção).
 * - A próxima consulta só sai `ms` depois da resposta anterior (nunca duas ao mesmo tempo).
 * - `setDado` (resposta de uma ação) vence qualquer consulta que já estava no ar.
 */
export function useConsulta<T>(caminho: string | null, ms: number) {
  const api = useApi();
  const [dado, setDadoBruto] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const geracao = useRef(0);
  const ultimoCaminho = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versao` é o gatilho da recarga.
  useEffect(() => {
    if (ultimoCaminho.current !== caminho) {
      ultimoCaminho.current = caminho;
      setDadoBruto(null);
      setErro(null);
    }
    if (!caminho) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const buscar = async () => {
      const minha = geracao.current;
      try {
        const d = await api.get<T>(caminho);
        if (ativo && minha === geracao.current) {
          setDadoBruto(d);
          setErro(null);
        }
      } catch (e) {
        if (ativo) setErro(mensagemDoErro(e));
      }
      if (ativo) timer = setTimeout(buscar, ms);
    };
    void buscar();
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
  }, [api, caminho, ms, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const setDado = useCallback((d: T | null) => {
    geracao.current++;
    setDadoBruto(d);
  }, []);
  return { dado, erro, recarregar, setDado };
}
