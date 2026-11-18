/** Corpo do pedido do better-auth como objeto (vazio quando não é um). */
export const bodyOf = (ctx: { body?: unknown }): Record<string, unknown> =>
  ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};
