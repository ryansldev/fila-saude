"use client";

import { type EuPainel, euPainelSchema } from "@fila-saude/schemas/auth";
import { useCallback, useEffect, useState } from "react";
import { type Api, ErroDaApi } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { menuDoPainel } from "@/lib/navegacao";

export type { EuPainel } from "@fila-saude/schemas/auth";
export { ApiProvider } from "@/lib/api-context";

const CAMINHO_EU = "/v1/painel/eu";
const CAMINHO_LOGIN = "/v1/painel/auth/sign-in/username";

/** `/eu` validado pelo contrato; fora dele é erro, não sessão. */
async function buscarEu(api: Api): Promise<EuPainel> {
  const resultado = euPainelSchema.safeParse(await api.get(CAMINHO_EU));
  if (!resultado.success) throw new Error("eu_fora_do_contrato");
  return resultado.data;
}

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
    buscarEu(api)
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

function classificarSignIn(e: unknown): ErroDeLogin {
  if (e instanceof ErroDaApi) {
    if (e.status === 423 || e.erro === "bloqueado") return "bloqueado";
    if (e.status === 401) return "credenciais";
  }
  return "rede";
}

/** PD-23: login do painel pelo `login` (plugin username do better-auth). */
async function entrar(api: Api, login: string, senha: string): Promise<EuPainel> {
  try {
    await api.post(CAMINHO_LOGIN, { username: login, password: senha });
  } catch (e) {
    throw new ErroDeEntrada(classificarSignIn(e));
  }
  // Falha do /eu depois do sign-in (ex.: cookie não chegou) não é erro de credenciais.
  try {
    return await buscarEu(api);
  } catch {
    throw new ErroDeEntrada("rede");
  }
}

class ErroDeEntrada extends Error {
  constructor(readonly tipo: ErroDeLogin) {
    super(tipo);
  }
}

export function useLogin(navegar: (href: string) => void) {
  const api = useApi();
  const [estado, setEstado] = useState<EstadoDoLogin>({ estado: "ocioso" });

  const enviar = useCallback(
    async (login: string, senha: string) => {
      setEstado({ estado: "enviando" });
      try {
        const eu = await entrar(api, login, senha);
        navegar(menuDoPainel(eu.perfis)[0]?.href ?? "/em-breve");
      } catch (e) {
        setEstado({ estado: "erro", erro: e instanceof ErroDeEntrada ? e.tipo : "rede" });
      }
    },
    [api, navegar],
  );

  return { estado, enviar };
}
