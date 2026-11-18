import { randomUUID } from "node:crypto";
import { APIError, isAPIError } from "better-auth/api";
import { ApiError, errorBody } from "infra/errors";
import { type AttemptStore, attemptErrors, attemptStore, type Change } from "./attempts";
import { bodyOf } from "./body";

type HookCtx = { path: string; body?: unknown; request?: unknown; context: { returned?: unknown } };

const LOGIN = "/sign-in/username";
/** Código do better-auth (plugin username) para login ou senha errados: só ele conta. */
const WRONG_PASSWORD = "INVALID_USERNAME_OR_PASSWORD";

const REFUSALS = {
  blocked: new ApiError(
    429,
    "login_locked",
    undefined,
    "Muitas tentativas com senha errada. Espere 15 minutos e tente de novo.",
  ),
  busy: new ApiError(
    429,
    "login_busy",
    undefined,
    "Ainda estamos conferindo a tentativa anterior. Espere alguns segundos e tente de novo.",
  ),
};

type Reservation = { id: string; at: number };
type LockoutOptions = { max: number; blockMs: number; reservationMs: number };
type LockState = { failures: number; blockedUntil: number | null; pending: Reservation[]; lastFailure: number };

// Sem tentativa por 7 dias, os erros são esquecidos e a linha sai do banco: a chave não fica guardada
// para sempre (LGPD). Quem espaça os erros para escapar tenta no máximo 4 senhas por semana.
const FORGET_AFTER_MS = 7 * 24 * 60 * 60_000;

/**
 * Erros seguidos por chave, até acertar (sem janela: espaçar as tentativas não escapa da contagem).
 * No máximo, bloqueia por `blockMs`. Guardado num `AttemptStore` (o Postgres, comum a todas as
 * instâncias, NC5).
 */
export class Lockout {
  constructor(
    private readonly options: LockoutOptions,
    private readonly store: AttemptStore = attemptStore,
  ) {}

  /** O estado de agora: reservas vencidas saem; bloqueio vencido zera os erros. */
  private current(state: LockState | null, now: number): LockState {
    const s = state ?? { failures: 0, blockedUntil: null, pending: [], lastFailure: 0 };
    const pending = s.pending.filter((r) => r.at > now - this.options.reservationMs);
    if (s.blockedUntil !== null && now >= s.blockedUntil) return { ...s, failures: 0, blockedUntil: null, pending };
    return { ...s, pending };
  }

  private save<T>(s: LockState, result: T): Change<LockState, T> {
    if (s.failures === 0 && s.blockedUntil === null && s.pending.length === 0)
      return { state: null, expiresAt: 0, result };
    const lastReservation = Math.max(0, ...s.pending.map((r) => r.at + this.options.reservationMs));
    const expiresAt = Math.max(s.blockedUntil ?? 0, lastReservation, s.lastFailure + FORGET_AFTER_MS);
    return { state: s, expiresAt, result };
  }

  /**
   * Ocupa uma vaga enquanto o pedido corre (a leitura e a escrita são uma coisa só): pedidos em paralelo
   * não passam todos. Não liga o bloqueio; só `fail` conta. Devolve o token da reserva, `"blocked"` ou
   * `"busy"` (as vagas estão com pedidos que ainda correm).
   */
  reserve(key: string, now: number): Promise<string | "blocked" | "busy"> {
    return this.store.update<LockState, string | "blocked" | "busy">(`lockout:${key}`, now, (state) => {
      const s = this.current(state, now);
      if (s.blockedUntil !== null) return this.save(s, "blocked");
      if (s.failures + s.pending.length >= this.options.max) return this.save(s, "busy");
      const id = randomUUID();
      return this.save({ ...s, pending: [...s.pending, { id, at: now }] }, id);
    });
  }

  /** Solta a própria reserva sem contar (pedido inválido, erro do servidor). */
  release(key: string, token: string, now: number): Promise<void> {
    return this.store.update<LockState, void>(`lockout:${key}`, now, (state) => {
      const s = this.current(state, now);
      return this.save({ ...s, pending: s.pending.filter((r) => r.id !== token) }, undefined);
    });
  }

  /** A reserva era uma senha errada: conta; a que completa o máximo bloqueia. */
  fail(key: string, token: string, now: number): Promise<void> {
    return this.store.update<LockState, void>(`lockout:${key}`, now, (state) => {
      const c = this.current(state, now);
      const s = { ...c, pending: c.pending.filter((r) => r.id !== token) };
      if (s.blockedUntil !== null) return this.save(s, undefined);
      const failures = s.failures + 1;
      const blockedUntil = failures >= this.options.max ? now + this.options.blockMs : null;
      return this.save({ ...s, failures, blockedUntil, lastFailure: now }, undefined);
    });
  }

  /** Acertou: solta a reserva e zera os erros. */
  reset(key: string, token: string, now: number): Promise<void> {
    return this.store.update<LockState, void>(`lockout:${key}`, now, (state) => {
      const s = this.current(state, now);
      const pending = s.pending.filter((r) => r.id !== token);
      return this.save({ failures: 0, blockedUntil: null, pending, lastFailure: 0 }, undefined);
    });
  }
}

/**
 * RN-ID-04: 5 senhas erradas seguidas bloqueiam o login por 15 min (acertar zera). Usado pelo login do
 * paciente (por CPF) e da equipe (por município e login). Um contador por módulo: a chave já separa
 * os municípios, e o auth de um município pode ser recriado sem zerar a contagem.
 *
 * Cada pedido reserva uma vaga antes de conferir a senha (pedidos em paralelo não passam todos) e, no
 * fim, solta a própria vaga; só conta quando a resposta é "senha errada". Pedido sem login ou sem senha
 * não reserva nem conta. Se o pedido cair sem resposta (o better-auth não roda o `after` em erro que
 * não é `APIError`), a reserva vence sozinha em 1 min.
 */
export function loginLockout(
  keyOf: (ctx: HookCtx) => string,
  store: AttemptStore = attemptStore,
  onError: (error: unknown) => void = (error) => attemptErrors.log(error, "contagem do login"),
) {
  // O bloqueio dura 15 min; uma reserva sem resposta vence em 1 min (a senha leva bem menos).
  const attempts = new Lockout({ max: 5, blockMs: 15 * 60_000, reservationMs: 60_000 }, store);
  // O objeto do pedido é o mesmo no `before` e no `after`: guarda o token da reserva dele.
  const tokens = new WeakMap<object, string>();
  const holder = (ctx: HookCtx): object => (ctx.request as object | undefined) ?? ctx.context;
  const key = (ctx: HookCtx, scope: string) => `${scope}:${keyOf(ctx)}`;
  return {
    async before(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const body = bodyOf(ctx);
      if (!body.username || !body.password) return;
      const r = await attempts.reserve(key(ctx, scope), Date.now());
      if (r !== "blocked" && r !== "busy") return void tokens.set(holder(ctx), r);
      const error = REFUSALS[r];
      // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
      throw new APIError(error.status as 400, errorBody(error));
    },
    async after(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const token = tokens.get(holder(ctx));
      if (token === undefined) return;
      tokens.delete(holder(ctx));
      const k = key(ctx, scope);
      const back = ctx.context.returned;
      const now = Date.now();
      // A resposta já está pronta (a sessão pode ter sido criada): uma falha ao contar vai para o log e não
      // vira erro; a reserva vence sozinha em 1 min.
      try {
        if (!isAPIError(back)) await attempts.reset(k, token, now);
        else if (back.body?.code === WRONG_PASSWORD) await attempts.fail(k, token, now);
        else await attempts.release(k, token, now);
      } catch (error) {
        onError(error);
      }
    },
  };
}
