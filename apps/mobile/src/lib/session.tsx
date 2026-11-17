import { router } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { type Api, createApi, type RegistrationData, register, signIn } from "./api";
import { API_URL } from "./config";
import { leavePush, type NoticeState, noticeState, registerPush, turnOnNotices } from "./push";
import * as storage from "./storage";

const TOKEN_KEY = "fila-saude.token";
const MUNICIPALITY_KEY = "fila-saude.municipio";
const EXPLAINED_NOTICE_KEY = "fila-saude.avisos-explicados";

/** `cpf`: só dígitos; serve para não aceitar o CPF do dono como "outra pessoa". */
export type Account = { name: string; birthDate: string; cpf: string };

type Session = {
  ready: boolean;
  token: string | null;
  municipality: string | null;
  account: Account | null;
  api: Api;
  /** null enquanto lê; relido quando o app volta para a frente (a pessoa pode ter mudado nos ajustes). */
  notices: NoticeState | null;
  /** A tela que explica os avisos já passou neste aparelho ("ligar" ou "agora não"). */
  explainedNotices: boolean;
  turnOnNotices(): Promise<void>;
  skipNotices(): Promise<void>;
  signIn(cpf: string, password: string): Promise<void>;
  register(data: RegistrationData): Promise<void>;
  chooseMunicipality(slug: string): Promise<void>;
  leave(): Promise<void>;
};

const Context = createContext<Session | null>(null);

/** Token da conta (central) e município escolhido, guardados no SecureStore do aparelho. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [notices, setNotices] = useState<NoticeState | null>(null);
  const [explainedNotices, setExplainedNotices] = useState(false);

  useEffect(() => {
    void (async () => {
      setNotices(await noticeState());
      // Keystore com problema em alguns Android: sem isso o app ficaria em branco para sempre.
      try {
        setToken(await storage.read(TOKEN_KEY));
        setMunicipality(await storage.read(MUNICIPALITY_KEY));
        setExplainedNotices((await storage.read(EXPLAINED_NOTICE_KEY)) === "1");
      } catch {
        setToken(null);
      } finally {
        setReady(true);
      }
    })();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void noticeState().then(setNotices);
    });
    return () => sub.remove();
  }, []);

  const markExplained = useCallback(async () => {
    await storage.save(EXPLAINED_NOTICE_KEY, "1").catch(() => {});
    setExplainedNotices(true);
  }, []);

  const forgetAccount = useCallback(async () => {
    await storage.erase(TOKEN_KEY).catch(() => {});
    setToken(null);
    setAccount(null);
  }, []);

  // 401 em qualquer rota: a sessão expirou ou foi revogada; esquece a conta e vai direto ao login, para a
  // pessoa nunca ficar presa numa tela que só dá erro.
  // Vários pedidos com o mesmo token podem voltar 401 juntos: só o primeiro leva ao login.
  const currentToken = useRef<string | null>(null);
  currentToken.current = token;
  const api = useMemo(
    () =>
      createApi(
        API_URL,
        async () => token,
        fetch,
        () => {
          if (!token || currentToken.current !== token) return;
          currentToken.current = null;
          void forgetAccount();
          router.replace("/entrar");
        },
      ),
    [token, forgetAccount],
  );

  useEffect(() => {
    if (!token) {
      setAccount(null);
      return;
    }
    api
      .get<{ user: { name: string; birthDate: string; cpf: string } } | null>("/v1/auth/get-session")
      .then((s) => setAccount(s ? { name: s.user.name, birthDate: s.user.birthDate, cpf: s.user.cpf ?? "" } : null))
      .catch(() => setAccount(null));
  }, [api, token]);

  // T3.8: a cada login, abertura com conta ou volta dos ajustes com os avisos ligados, o aparelho avisa a
  // conta certa. Só registra: o pedido de permissão vem depois da tela que explica os avisos.
  const onNotices = notices?.kind === "on";
  useEffect(() => {
    if (token && onNotices) void registerPush(api);
  }, [api, token, onNotices]);

  const storeToken = useCallback(async (t: string) => {
    await storage.save(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const value: Session = {
    ready,
    token,
    municipality,
    account,
    api,
    notices,
    explainedNotices,
    turnOnNotices: async () => {
      setNotices(await turnOnNotices());
      await markExplained();
    },
    skipNotices: markExplained,
    signIn: async (cpf, password) => storeToken(await signIn(API_URL, cpf, password)),
    register: async (data) => storeToken(await register(API_URL, data)),
    chooseMunicipality: async (slug) => {
      await storage.save(MUNICIPALITY_KEY, slug);
      setMunicipality(slug);
    },
    leave: async () => {
      // Este aparelho para de receber os avisos da conta e a sessão morre no servidor (aparelho compartilhado).
      await leavePush(api);
      await api.post("/v1/auth/sign-out").catch(() => {});
      await forgetAccount();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSession(): Session {
  const s = useContext(Context);
  if (!s) throw new Error("useSessao fora do ProvedorDeSessao");
  return s;
}
