import { router } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { type Api, cadastrar, criarApi, type DadosDoCadastro, entrar } from "./api";
import * as armazenamento from "./armazenamento";
import { API_URL } from "./config";
import { type EstadoDosAvisos, estadoDosAvisos, ligarAvisos, registrarPush, sairDoPush } from "./push";

const CHAVE_TOKEN = "fila-saude.token";
const CHAVE_MUNICIPIO = "fila-saude.municipio";
const CHAVE_AVISOS_EXPLICADOS = "fila-saude.avisos-explicados";

/** `cpf`: só dígitos; serve para não aceitar o CPF do dono como "outra pessoa". */
export type Conta = { nome: string; nascimento: string; cpf: string };

type Sessao = {
  pronto: boolean;
  token: string | null;
  municipio: string | null;
  conta: Conta | null;
  api: Api;
  /** null enquanto lê; relido quando o app volta para a frente (a pessoa pode ter mudado nos ajustes). */
  avisos: EstadoDosAvisos | null;
  /** A tela que explica os avisos já passou neste aparelho ("ligar" ou "agora não"). */
  avisosExplicados: boolean;
  ligarAvisos(): Promise<void>;
  pularAvisos(): Promise<void>;
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
  const [avisos, setAvisos] = useState<EstadoDosAvisos | null>(null);
  const [avisosExplicados, setAvisosExplicados] = useState(false);

  useEffect(() => {
    void (async () => {
      setAvisos(await estadoDosAvisos());
      // Keystore com problema em alguns Android: sem isso o app ficaria em branco para sempre.
      try {
        setToken(await armazenamento.ler(CHAVE_TOKEN));
        setMunicipio(await armazenamento.ler(CHAVE_MUNICIPIO));
        setAvisosExplicados((await armazenamento.ler(CHAVE_AVISOS_EXPLICADOS)) === "1");
      } catch {
        setToken(null);
      } finally {
        setPronto(true);
      }
    })();
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void estadoDosAvisos().then(setAvisos);
    });
    return () => sub.remove();
  }, []);

  const marcarExplicados = useCallback(async () => {
    await armazenamento.gravar(CHAVE_AVISOS_EXPLICADOS, "1").catch(() => {});
    setAvisosExplicados(true);
  }, []);

  const esquecerConta = useCallback(async () => {
    await armazenamento.apagar(CHAVE_TOKEN).catch(() => {});
    setToken(null);
    setConta(null);
  }, []);

  // 401 em qualquer rota: a sessão expirou ou foi revogada; esquece a conta e vai direto ao login, para a
  // pessoa nunca ficar presa numa tela que só dá erro.
  // Vários pedidos com o mesmo token podem voltar 401 juntos: só o primeiro leva ao login.
  const tokenAtual = useRef<string | null>(null);
  tokenAtual.current = token;
  const api = useMemo(
    () =>
      criarApi(
        API_URL,
        async () => token,
        fetch,
        () => {
          if (!token || tokenAtual.current !== token) return;
          tokenAtual.current = null;
          void esquecerConta();
          router.replace("/entrar");
        },
      ),
    [token, esquecerConta],
  );

  useEffect(() => {
    if (!token) {
      setConta(null);
      return;
    }
    api
      .get<{ user: { name: string; nascimento: string; cpf: string } } | null>("/v1/auth/get-session")
      .then((s) => setConta(s ? { nome: s.user.name, nascimento: s.user.nascimento, cpf: s.user.cpf ?? "" } : null))
      .catch(() => setConta(null));
  }, [api, token]);

  // T3.8: a cada login, abertura com conta ou volta dos ajustes com os avisos ligados, o aparelho avisa a
  // conta certa. Só registra: o pedido de permissão vem depois da tela que explica os avisos.
  const avisosLigados = avisos?.tipo === "ligados";
  useEffect(() => {
    if (token && avisosLigados) void registrarPush(api);
  }, [api, token, avisosLigados]);

  const guardarToken = useCallback(async (t: string) => {
    await armazenamento.gravar(CHAVE_TOKEN, t);
    setToken(t);
  }, []);

  const valor: Sessao = {
    pronto,
    token,
    municipio,
    conta,
    api,
    avisos,
    avisosExplicados,
    ligarAvisos: async () => {
      setAvisos(await ligarAvisos());
      await marcarExplicados();
    },
    pularAvisos: marcarExplicados,
    entrar: async (cpf, senha) => guardarToken(await entrar(API_URL, cpf, senha)),
    cadastrar: async (dados) => guardarToken(await cadastrar(API_URL, dados)),
    escolherMunicipio: async (slug) => {
      await armazenamento.gravar(CHAVE_MUNICIPIO, slug);
      setMunicipio(slug);
    },
    sair: async () => {
      // Este aparelho para de receber os avisos da conta e a sessão morre no servidor (aparelho compartilhado).
      await sairDoPush(api);
      await api.post("/v1/auth/sign-out").catch(() => {});
      await esquecerConta();
    },
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora do ProvedorDeSessao");
  return s;
}
