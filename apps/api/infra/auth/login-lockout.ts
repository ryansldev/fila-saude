import { APIError, isAPIError } from "better-auth/api";
import { ApiError, errorBody } from "infra/errors";
import { Attempts } from "./attempts";

type HookCtx = { path: string; body?: unknown; context: { returned?: unknown } };

const LOGIN = "/sign-in/username";
/** Código do better-auth (plugin username) para login ou senha errados: só ele conta. */
const WRONG_PASSWORD = "INVALID_USERNAME_OR_PASSWORD";

/**
 * RN-ID-04: 5 senhas erradas seguidas bloqueiam o login por 15 min (acertar zera). Usado pelo login do
 * paciente (por CPF) e da equipe (por município e login). Um contador por módulo: a chave já separa
 * os municípios, e o auth de um município pode ser recriado sem zerar a contagem.
 *
 * A vaga é reservada antes de conferir a senha (pedidos em paralelo não passam todos) e só conta
 * quando a resposta é "senha errada". Se o pedido cair sem resposta (o better-auth não roda o `after`
 * em erro que não é `APIError`), a reserva vence sozinha em 30 s.
 */
export function loginLockout(keyOf: (ctx: HookCtx) => string) {
  const attempts = new Attempts({ max: 5, windowMs: 15 * 60_000, lockout: true });
  const key = (ctx: HookCtx, scope: string) => `${scope}:${keyOf(ctx)}`;
  return {
    before(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN || attempts.reserve(key(ctx, scope), Date.now())) return;
      const error = new ApiError(
        429,
        "login_locked",
        undefined,
        "Muitas tentativas com senha errada. Espere 15 minutos e tente de novo.",
      );
      // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
      throw new APIError(error.status as 400, errorBody(error));
    },
    after(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const k = key(ctx, scope);
      const back = ctx.context.returned;
      if (!isAPIError(back)) return attempts.reset(k);
      if (back.body?.code === WRONG_PASSWORD) attempts.fail(k, Date.now());
      else attempts.release(k);
    },
  };
}
