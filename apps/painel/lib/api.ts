import { errorSchema } from "@fila-saude/schemas/errors";

/** Erro no formato único da API (PD-22): `{ erro, mensagem?, campos? }` mais o status HTTP. */
export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly userMessage?: string;
  readonly fields?: Record<string, string[]>;
  readonly data?: Record<string, unknown>;

  constructor(
    status: number,
    error: string,
    message?: string,
    fields?: Record<string, string[]>,
    data?: Record<string, unknown>,
  ) {
    super(message ?? error);
    this.name = "ApiError";
    this.status = status;
    this.error = error;
    if (message !== undefined) this.userMessage = message;
    if (fields !== undefined) this.fields = fields;
    if (data !== undefined) this.data = data;
  }
}

export type Api = {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string): Promise<T>;
};

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const NOT_JSON = Symbol("not_json");

async function readJson(answer: Response): Promise<unknown> {
  const text = await answer.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

/** Cliente da API do painel: cookie da sessão sempre (`credentials: "include"`), JSON na ida e na volta. */
export function createApi(base: string, fetcher: typeof fetch = fetch, onExpire?: () => void): Api {
  async function request<T>(method: Method, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json", ...extra };
    const init: RequestInit = { method: method, credentials: "include", headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let answer: Response;
    try {
      answer = await fetcher(`${base}${path}`, init);
    } catch {
      throw new ApiError(0, "no_connection");
    }

    const data = await readJson(answer);
    if (answer.ok && data === NOT_JSON) throw new ApiError(answer.status, "invalid_response");
    if (!answer.ok) {
      const body = errorSchema.safeParse(data);
      // Sessão vencida: avisa uma vez para o painel voltar ao login (senão as consultas repetem 401).
      if (answer.status === 401) onExpire?.();
      if (body.success) {
        const { error, message, fields, data: extra } = body.data;
        throw new ApiError(answer.status, error, message, fields, extra);
      }
      throw new ApiError(answer.status, "invalid_response");
    }
    return data as T;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body, headers) => request("POST", path, body, headers),
    patch: (path, body) => request("PATCH", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
  };
}
