import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Api, cadastrar, criarApi, type DadosDoCadastro, entrar } from "./api";
import { API_URL } from "./config";

const CHAVE_TOKEN = "fila-saude.token";
const CHAVE_MUNICIPIO = "fila-saude.municipio";

export type Conta = { nome: string; nascimento: string };

type Sessao = {
  pronto: boolean;
  token: string | null;
  municipio: string | null;
  conta: Conta | null;
  api: Api;
  entrar(cpf: string, senha: string): Promise<void>;
  cadastrar(dados: DadosDoCadastro): Promise<void>;
  escolherMunicipio(slug: string): Promise<void>;
  sair(): Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

/** Token da conta (central) e município escolhido, guardados no SecureStore do aparelho. */
export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [conta, setConta] = useState<Conta | null>(null);

  useEffect(() => {
    void (async () => {
      setToken(await SecureStore.getItemAsync(CHAVE_TOKEN));
      setMunicipio(await SecureStore.getItemAsync(CHAVE_MUNICIPIO));
      setPronto(true);
    })();
  }, []);

  const api = useMemo(() => criarApi(API_URL, async () => token), [token]);

  useEffect(() => {
    if (!token) {
      setConta(null);
      return;
    }
    api
      .get<{ user: { name: string; nascimento: string } } | null>("/v1/auth/get-session")
      .then((s) => setConta(s ? { nome: s.user.name, nascimento: s.user.nascimento } : null))
      .catch(() => setConta(null));
  }, [api, token]);

  const guardarToken = useCallback(async (t: string) => {
    await SecureStore.setItemAsync(CHAVE_TOKEN, t);
    setToken(t);
  }, []);

  const valor: Sessao = {
    pronto,
    token,
    municipio,
    conta,
    api,
    entrar: async (cpf, senha) => guardarToken(await entrar(API_URL, cpf, senha)),
    cadastrar: async (dados) => guardarToken(await cadastrar(API_URL, dados)),
    escolherMunicipio: async (slug) => {
      await SecureStore.setItemAsync(CHAVE_MUNICIPIO, slug);
      setMunicipio(slug);
    },
    sair: async () => {
      await SecureStore.deleteItemAsync(CHAVE_TOKEN);
      setToken(null);
    },
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora do ProvedorDeSessao");
  return s;
}
