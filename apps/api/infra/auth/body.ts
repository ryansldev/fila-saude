import { APIError } from "better-auth/api";
import { ApiError, errorBody } from "infra/errors";

/** Corpo do pedido do better-auth como objeto (vazio quando não é um). */
export const bodyOf = (ctx: { body?: unknown }): Record<string, unknown> =>
  ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};

/** PD-22: o `ApiError` da Fila Saúde vira o `APIError` do better-auth, com o corpo já no formato. */
export function authAsError(err: unknown): unknown {
  // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
  return err instanceof ApiError ? new APIError(err.status as 400, errorBody(err)) : err;
}
