"use client";

import type { Perfil } from "@fila-saude/domain";
import { useCallback, useEffect, useState } from "react";
import { type Api, ErroDaApi } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { menuDoPainel } from "@/lib/navegacao";

export { ApiProvider } from "@/lib/api-context";

// TODO(1B T16): trocar por euPainelSchema
export type EuPainel = { id: string; nome: string; perfis: { perfil: Perfil; unidadeId: string | null }[] };

const CAMINHO_EU = "/v1/painel/eu";
// TODO(1B T15): ajustar quando o endpoint de login do painel estiver definido
const CAMINHO_LOGIN = "/v1/painel/auth/sign-in/email";

export type EstadoDoEu =
  | { estado: "carregando" }
  | { estado: "anonimo" }
  | { estado: "erro" }
  | { estado: "autenticado"; eu: EuPainel };

/** Quem está logado no painel (cookie da sessão). 401 → anônimo. */
export function useEu(): EstadoDoEu {
  const api = useApi();
  const [estado, setEstado] = useState<EstadoDoEu>({ estado: "carregando" });

  useEffect(() => {
    let ativo = true;
    api
      .get<EuPainel>(CAMINHO_EU)
      .then((eu) => ativo && setEstado({ estado: "autenticado", eu }))
      .catch((e: unknown) => {
        if (!ativo) return;
        setEstado(e instanceof ErroDaApi && e.status === 401 ? { estado: "anonimo" } : { estado: "erro" });
      });
    return () => {
      ativo = false;
    };
  }, [api]);

  return estado;
}

export type ErroDeLogin = "credenciais" | "bloqueado" | "rede";
export type EstadoDoLogin = { estado: "ocioso" } | { estado: "enviando" } | { estado: "erro"; erro: ErroDeLogin };

function classificar(e: unknown): ErroDeLogin {
  if (e instanceof ErroDaApi) {
    if (e.status === 423 || e.erro === "bloqueado") return "bloqueado";
    if (e.status === 401) return "credenciais";
  }
  return "rede";
}

/** A única chamada de credenciais: ajustar aqui quando a 1B T15 definir o endpoint. */
async function entrar(api: Api, email: string, senha: string): Promise<EuPainel> {
  await api.post(CAMINHO_LOGIN, { email, password: senha });
  return api.get<EuPainel>(CAMINHO_EU);
}

export function useLogin(navegar: (href: string) => void) {
  const api = useApi();
  const [estado, setEstado] = useState<EstadoDoLogin>({ estado: "ocioso" });

  const enviar = useCallback(
    async (email: string, senha: string) => {
      setEstado({ estado: "enviando" });
      try {
        const eu = await entrar(api, email, senha);
        navegar(menuDoPainel(eu.perfis)[0]?.href ?? "/em-breve");
      } catch (e) {
        setEstado({ estado: "erro", erro: classificar(e) });
      }
    },
    [api, navegar],
  );

  return { estado, enviar };
}
