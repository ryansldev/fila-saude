/** Erro no formato da API (PD-22) mais o status; `no_connection` quando a rede falha. */
export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly userMessage: string | undefined;

  constructor(status: number, error: string, message?: string) {
    super(message ?? error);
    this.name = "ApiError";
    this.status = status;
    this.error = error;
    this.userMessage = message;
  }
}

export type Api = {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string, body?: unknown): Promise<T>;
};

async function readBody(r: Response): Promise<Record<string, unknown> | undefined> {
  const text = await r.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function requestRaw(
  fetcher: typeof fetch,
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  token: string | null,
  body?: unknown,
): Promise<{ answer: Response; data: Record<string, unknown> | undefined }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  let answer: Response;
  try {
    answer = await fetcher(url, {
      method: method,
      headers,
      // A conta vai só no token: o fetch do React Native reenviaria o cookie de uma sessão anterior, e o
      // better-auth recusa (403) pedido com cookie e sem Origin confiável.
      credentials: "omit",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, "no_connection");
  }
  const data = await readBody(answer);
  if (!answer.ok) {
    const error = typeof data?.error === "string" ? data.error : "invalid_response";
    const message = typeof data?.message === "string" ? data.message : undefined;
    throw new ApiError(answer.status, error, message);
  }
  return { answer, data };
}

/** Cliente das rotas do município e do catálogo: o token da conta vai em Authorization (PD-34). */
export function createApi(
  base: string,
  token: () => Promise<string | null>,
  fetcher: typeof fetch = fetch,
  onExpire?: () => void,
): Api {
  const request = async (url: string, method: "GET" | "POST" | "PUT" | "DELETE", body?: unknown) => {
    try {
      return await requestRaw(fetcher, url, method, await token(), body);
    } catch (err) {
      // Token vencido ou revogado: o app volta ao login em vez de repetir 401 a cada consulta.
      if (err instanceof ApiError && err.status === 401) onExpire?.();
      throw err;
    }
  };
  return {
    get: async <T>(path: string) => (await request(`${base}${path}`, "GET")).data as T,
    post: async <T>(path: string, body?: unknown) => (await request(`${base}${path}`, "POST", body ?? {})).data as T,
    put: async <T>(path: string, body?: unknown) => (await request(`${base}${path}`, "PUT", body ?? {})).data as T,
    del: async <T>(path: string, body?: unknown) => (await request(`${base}${path}`, "DELETE", body)).data as T,
  };
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function tokenOf(r: Response): string {
  const t = r.headers.get("set-auth-token");
  if (!t) throw new ApiError(r.status, "invalid_response");
  return t;
}

/** Login na central com CPF e senha (RN-ID-01); devolve o token. */
export async function signIn(base: string, cpf: string, password: string, fetcher: typeof fetch = fetch) {
  try {
    const { answer } = await requestRaw(fetcher, `${base}/v1/auth/sign-in/username`, "POST", null, {
      username: onlyDigits(cpf),
      password: password,
    });
    return tokenOf(answer);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 400)) throw new ApiError(e.status, "credentials");
    throw e;
  }
}

export type RegistrationData = {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
};

/** Cadastro na central (RN-ID-01, PD-23); devolve o token da conta nova. */
export async function register(base: string, data: RegistrationData, fetcher: typeof fetch = fetch) {
  const { answer } = await requestRaw(fetcher, `${base}/v1/auth/sign-up/email`, "POST", null, {
    ...data,
    cpf: onlyDigits(data.cpf),
  });
  return tokenOf(answer);
}
