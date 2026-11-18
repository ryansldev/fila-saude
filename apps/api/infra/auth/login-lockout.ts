import { APIError, isAPIError } from "better-auth/api";
import { ApiError, errorBody } from "infra/errors";
import { LRUCache } from "lru-cache";
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

type Reservation = { id: number; at: number };
type LockoutOptions = { max: number; blockMs: number; reservationMs: number };

/**
 * Erros seguidos por chave, até acertar (sem janela: espaçar as tentativas não escapa da contagem).
 * No máximo, bloqueia por `blockMs`. Em memória (instância única, NC5). Os erros ficam num LRU
 * (um erro esquecido só alivia quem tem conta inativa há muito); bloqueios e reservas, em mapas
 * que se limpam sozinhos, sem tamanho fixo pré-alocado.
 */
export class Lockout {
  private readonly failures = new LRUCache<string, number>({ max: 100_000 });
  private readonly blockedUntil = new Map<string, number>();
  private readonly pending = new Map<string, Reservation[]>();
  private next = 0;

  constructor(private readonly options: LockoutOptions) {}

  private prune(now: number): void {
    if (this.blockedUntil.size > 10_000) {
      for (const [k, until] of this.blockedUntil) if (until <= now) this.blockedUntil.delete(k);
    }
    if (this.pending.size > 10_000) {
      for (const [k] of this.pending) this.live(k, now);
    }
  }

  private live(key: string, now: number): Reservation[] {
    const list = (this.pending.get(key) ?? []).filter((r) => r.at > now - this.options.reservationMs);
    if (list.length === 0) this.pending.delete(key);
    else this.pending.set(key, list);
    return list;
  }

  private blocked(key: string, now: number): boolean {
    const until = this.blockedUntil.get(key);
    if (until === undefined) return false;
    if (now < until) return true;
    this.blockedUntil.delete(key);
    this.failures.delete(key);
    return false;
  }

  /**
   * Ocupa uma vaga enquanto o pedido corre (sem `await` entre checar e ocupar): pedidos em paralelo
   * não passam todos. Não liga o bloqueio; só `fail` conta. Devolve o token da reserva, `"blocked"`
   * ou `"busy"` (as vagas estão com pedidos que ainda correm).
   */
  reserve(key: string, now: number): number | "blocked" | "busy" {
    this.prune(now);
    if (this.blocked(key, now)) return "blocked";
    const live = this.live(key, now);
    if ((this.failures.get(key) ?? 0) + live.length >= this.options.max) return "busy";
    const id = ++this.next;
    this.pending.set(key, [...live, { id, at: now }]);
    return id;
  }

  /** Solta a própria reserva sem contar (pedido inválido, erro do servidor). */
  release(key: string, token: number): void {
    const list = (this.pending.get(key) ?? []).filter((r) => r.id !== token);
    if (list.length === 0) this.pending.delete(key);
    else this.pending.set(key, list);
  }

  /** A reserva era uma senha errada: conta; a que completa o máximo bloqueia. */
  fail(key: string, token: number, now: number): void {
    this.release(key, token);
    if (this.blocked(key, now)) return;
    const n = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, n);
    if (n >= this.options.max) this.blockedUntil.set(key, now + this.options.blockMs);
  }

  /** Acertou: solta a reserva e zera os erros. */
  reset(key: string, token: number): void {
    this.release(key, token);
    this.failures.delete(key);
    this.blockedUntil.delete(key);
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
export function loginLockout(keyOf: (ctx: HookCtx) => string) {
  // O bloqueio dura 15 min; uma reserva sem resposta vence em 1 min (a senha leva bem menos).
  const attempts = new Lockout({ max: 5, blockMs: 15 * 60_000, reservationMs: 60_000 });
  // O objeto do pedido é o mesmo no `before` e no `after`: guarda o token da reserva dele.
  const tokens = new WeakMap<object, number>();
  const holder = (ctx: HookCtx): object => (ctx.request as object | undefined) ?? ctx.context;
  const key = (ctx: HookCtx, scope: string) => `${scope}:${keyOf(ctx)}`;
  return {
    before(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const body = bodyOf(ctx);
      if (!body.username || !body.password) return;
      const r = attempts.reserve(key(ctx, scope), Date.now());
      if (typeof r === "number") return void tokens.set(holder(ctx), r);
      const error = REFUSALS[r];
      // O tipo do `APIError` só aceita os status nomeados; em tempo de execução o número passa direto.
      throw new APIError(error.status as 400, errorBody(error));
    },
    after(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const token = tokens.get(holder(ctx));
      if (token === undefined) return;
      tokens.delete(holder(ctx));
      const k = key(ctx, scope);
      const back = ctx.context.returned;
      if (!isAPIError(back)) attempts.reset(k, token);
      else if (back.body?.code === WRONG_PASSWORD) attempts.fail(k, token, Date.now());
      else attempts.release(k, token);
    },
  };
}
