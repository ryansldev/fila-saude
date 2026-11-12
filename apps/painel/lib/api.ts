import { erroSchema } from "@fila-saude/schemas/erros";

/** Erro no formato único da API (PD-22): `{ erro, mensagem?, campos? }` mais o status HTTP. */
export class ErroDaApi extends Error {
  readonly status: number;
  readonly erro: string;
  readonly mensagem?: string;
  readonly campos?: Record<string, string[]>;
  readonly dados?: Record<string, unknown>;

  constructor(
    status: number,
    erro: string,
    mensagem?: string,
    campos?: Record<string, string[]>,
    dados?: Record<string, unknown>,
  ) {
    super(mensagem ?? erro);
    this.name = "ErroDaApi";
    this.status = status;
    this.erro = erro;
    if (mensagem !== undefined) this.mensagem = mensagem;
    if (campos !== undefined) this.campos = campos;
    if (dados !== undefined) this.dados = dados;
  }
}

export type Api = {
  get<T = unknown>(caminho: string): Promise<T>;
  post<T = unknown>(caminho: string, corpo?: unknown): Promise<T>;
  patch<T = unknown>(caminho: string, corpo?: unknown): Promise<T>;
  put<T = unknown>(caminho: string, corpo?: unknown): Promise<T>;
  del<T = unknown>(caminho: string): Promise<T>;
};

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const NAO_JSON = Symbol("nao_json");

async function lerJson(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return NAO_JSON;
  }
}

/** Cliente da API do painel: cookie da sessão sempre (`credentials: "include"`), JSON na ida e na volta. */
export function criarApi(base: string, fetcher: typeof fetch = fetch): Api {
  async function pedir<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
    const init: RequestInit = { method: metodo, credentials: "include", headers: { accept: "application/json" } };
    if (corpo !== undefined) {
      init.headers = { accept: "application/json", "content-type": "application/json" };
      init.body = JSON.stringify(corpo);
    }

    let resposta: Response;
    try {
      resposta = await fetcher(`${base}${caminho}`, init);
    } catch {
      throw new ErroDaApi(0, "sem_conexao");
    }

    const dados = await lerJson(resposta);
    if (resposta.ok && dados === NAO_JSON) throw new ErroDaApi(resposta.status, "resposta_invalida");
    if (!resposta.ok) {
      const corpo = erroSchema.safeParse(dados);
      if (corpo.success) {
        const { erro, mensagem, campos, dados: extra } = corpo.data;
        throw new ErroDaApi(resposta.status, erro, mensagem, campos, extra);
      }
      throw new ErroDaApi(resposta.status, "resposta_invalida");
    }
    return dados as T;
  }

  return {
    get: (caminho) => pedir("GET", caminho),
    post: (caminho, corpo) => pedir("POST", caminho, corpo),
    patch: (caminho, corpo) => pedir("PATCH", caminho, corpo),
    put: (caminho, corpo) => pedir("PUT", caminho, corpo),
    del: (caminho) => pedir("DELETE", caminho),
  };
}
