"use client";

import { type StaffMe, staffMeSchema } from "@fila-saude/schemas/auth";
import { useCallback, useEffect, useState } from "react";
import { type Api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { panelMenu } from "@/lib/navigation";

export type { StaffMe } from "@fila-saude/schemas/auth";
export { ApiProvider } from "@/lib/api-context";

const ME_PATH = "/v1/panel/me";
const LOGIN_PATH = "/v1/panel/auth/sign-in/username";

/** `/eu` validado pelo contrato; fora dele é erro, não sessão. */
async function fetchMe(api: Api): Promise<StaffMe> {
  const result = staffMeSchema.safeParse(await api.get(ME_PATH));
  if (!result.success) throw new Error("me_out_of_contract");
  return result.data;
}

export type MeState =
  | { state: "loading" }
  | { state: "anonymous" }
  | { state: "error" }
  | { state: "authenticated"; me: StaffMe };

/** Quem está logado no painel (cookie da sessão). 401 → anônimo. */
export function useMe(): MeState {
  const api = useApi();
  const [state, setState] = useState<MeState>({ state: "loading" });

  useEffect(() => {
    let active = true;
    fetchMe(api)
      .then((me) => active && setState({ state: "authenticated", me }))
      .catch((e: unknown) => {
        if (!active) return;
        setState(e instanceof ApiError && e.status === 401 ? { state: "anonymous" } : { state: "error" });
      });
    return () => {
      active = false;
    };
  }, [api]);

  return state;
}

export type LoginError = "credentials" | "blocked" | "network";
export type LoginState = { state: "idle" } | { state: "sending" } | { state: "error"; error: LoginError };

function classifySignIn(e: unknown): LoginError {
  if (e instanceof ApiError) {
    if (e.status === 423 || e.status === 429 || e.error === "blocked") return "blocked";
    // 422: o plugin username recusa o formato do login (ex.: com espaço): para quem digita, é login errado.
    if (e.status === 401 || e.status === 422) return "credentials";
  }
  return "network";
}

/** PD-23: login do painel pelo `login` (plugin username do better-auth). */
async function signIn(api: Api, login: string, password: string): Promise<StaffMe> {
  try {
    await api.post(LOGIN_PATH, { username: login, password: password });
  } catch (e) {
    throw new EntryError(classifySignIn(e));
  }
  // Falha do /eu depois do sign-in (ex.: cookie não chegou) não é erro de credenciais.
  try {
    return await fetchMe(api);
  } catch {
    throw new EntryError("network");
  }
}

class EntryError extends Error {
  constructor(readonly kind: LoginError) {
    super(kind);
  }
}

export function useLogin(navigate: (href: string) => void) {
  const api = useApi();
  const [state, setState] = useState<LoginState>({ state: "idle" });

  const send = useCallback(
    async (login: string, password: string) => {
      setState({ state: "sending" });
      try {
        const me = await signIn(api, login, password);
        navigate(panelMenu(me.profiles)[0]?.href ?? "/em-breve");
      } catch (e) {
        setState({ state: "error", error: e instanceof EntryError ? e.kind : "network" });
      }
    },
    [api, navigate],
  );

  return { state, send };
}

/** Sai do painel: encerra a sessão no better-auth do município e volta ao login, mesmo se a API falhar. */
export async function leave(api: Api, navigate: (href: string) => void): Promise<void> {
  try {
    await api.post("/v1/panel/auth/sign-out", {});
  } catch {
    // Sem conexão: o cookie expira sozinho; a tela de login é o destino de qualquer jeito.
  }
  navigate("/login");
}
