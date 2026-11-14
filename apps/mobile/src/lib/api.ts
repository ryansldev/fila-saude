/** Erro no formato da API (PD-22) mais o status; `sem_conexao` quando a rede falha. */
export class ErroDaApi extends Error {
  readonly status: number;
  readonly erro: string;
  readonly mensagem: string | undefined;

  constructor(status: number, erro: string, mensagem?: string) {
    super(mensagem ?? erro);
    this.name = "ErroDaApi";
    this.status = status;
    this.erro = erro;
    this.mensagem = mensagem;
  }
}

export type Api = {
  get<T = unknown>(caminho: string): Promise<T>;
  post<T = unknown>(caminho: string, corpo?: unknown): Promise<T>;
  put<T = unknown>(caminho: string, corpo?: unknown): Promise<T>;
};

async function lerCorpo(r: Response): Promise<Record<string, unknown> | undefined> {
  const texto = await r.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function pedir(
  fetcher: typeof fetch,
  url: string,
  metodo: "GET" | "POST" | "PUT",
  token: string | null,
  corpo?: unknown,
): Promise<{ resposta: Response; dados: Record<string, unknown> | undefined }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers["content-type"] = "application/json";
  let resposta: Response;
  try {
    resposta = await fetcher(url, {
      method: metodo,
      headers,
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    throw new ErroDaApi(0, "sem_conexao");
  }
  const dados = await lerCorpo(resposta);
  if (!resposta.ok) {
    const erro = typeof dados?.erro === "string" ? dados.erro : "resposta_invalida";
    const mensagem = typeof dados?.mensagem === "string" ? dados.mensagem : undefined;
    throw new ErroDaApi(resposta.status, erro, mensagem);
  }
  return { resposta, dados };
}

/** Cliente das rotas do município e do catálogo: o token da conta vai em Authorization (PD-34). */
export function criarApi(base: string, token: () => Promise<string | null>, fetcher: typeof fetch = fetch): Api {
  return {
    get: async <T>(caminho: string) => (await pedir(fetcher, `${base}${caminho}`, "GET", await token())).dados as T,
    post: async <T>(caminho: string, corpo?: unknown) =>
      (await pedir(fetcher, `${base}${caminho}`, "POST", await token(), corpo ?? {})).dados as T,
    put: async <T>(caminho: string, corpo?: unknown) =>
      (await pedir(fetcher, `${base}${caminho}`, "PUT", await token(), corpo ?? {})).dados as T,
  };
}

const soDigitos = (s: string) => s.replace(/\D/g, "");

function tokenDe(r: Response): string {
  const t = r.headers.get("set-auth-token");
  if (!t) throw new ErroDaApi(r.status, "resposta_invalida");
  return t;
}

/** Login na central com CPF e senha (RN-ID-01); devolve o token. */
export async function entrar(base: string, cpf: string, senha: string, fetcher: typeof fetch = fetch) {
  try {
    const { resposta } = await pedir(fetcher, `${base}/v1/auth/sign-in/username`, "POST", null, {
      username: soDigitos(cpf),
      password: senha,
    });
    return tokenDe(resposta);
  } catch (e) {
    if (e instanceof ErroDaApi && (e.status === 401 || e.status === 400)) throw new ErroDaApi(e.status, "credenciais");
    throw e;
  }
}

export type DadosDoCadastro = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  nascimento: string;
  senha: string;
};

/** Cadastro na central (RN-ID-01, PD-23); devolve o token da conta nova. */
export async function cadastrar(base: string, dados: DadosDoCadastro, fetcher: typeof fetch = fetch) {
  const { resposta } = await pedir(fetcher, `${base}/v1/auth/sign-up/email`, "POST", null, {
    ...dados,
    cpf: soDigitos(dados.cpf),
  });
  return tokenDe(resposta);
}
