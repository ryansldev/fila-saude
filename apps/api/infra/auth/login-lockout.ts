import { APIError, isAPIError } from "better-auth/api";
import { ApiError, errorBody } from "infra/errors";
import { Attempts } from "./attempts";

type HookCtx = { path: string; body?: unknown; context: { returned?: unknown } };

const LOGIN = "/sign-in/username";
const WINDOW_MS = 15 * 60_000;

export const bodyOf = (ctx: { body?: unknown }): Record<string, unknown> =>
  ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};

/**
 * RN-ID-04: 5 senhas erradas seguidas bloqueiam o login por 15 min (acertar zera). Usado pelo login do
 * paciente (por CPF) e da equipe (por login do município). A tentativa é reservada antes de conferir a
 * senha (pedidos em paralelo não passam todos) e devolvida quando a resposta não foi "senha errada".
 */
export function loginLockout(keyOf: (ctx: HookCtx) => string) {
  const attempts = new Attempts({ max: 5, windowMs: WINDOW_MS });
  return {
    before(ctx: HookCtx) {
      if (ctx.path !== LOGIN || attempts.reserve(keyOf(ctx), Date.now())) return;
      const error = new ApiError(
        429,
        "login_locked",
        undefined,
        "Muitas tentativas com senha errada. Espere 15 minutos e tente de novo.",
      );
      // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
      throw new APIError(error.status as 400, errorBody(error));
    },
    after(ctx: HookCtx) {
      if (ctx.path !== LOGIN) return;
      const back = ctx.context.returned;
      const key = keyOf(ctx);
      if (!isAPIError(back)) return attempts.reset(key);
      if (back.statusCode === 429) return; // o próprio bloqueio (nada foi reservado)
      // Só "senha errada" conta; corpo inválido (400) e outros erros devolvem a tentativa.
      if (back.statusCode !== 401) attempts.refund(key);
    },
  };
}
