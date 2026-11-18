import { randomUUID } from "node:crypto";
import { CAPTCHA_HEADER } from "@fila-saude/schemas/captcha";
import { isAPIError } from "better-auth/api";
import { type CaptchaResult, checkCaptcha } from "infra/captcha";
import { ApiError } from "infra/errors";
import { type AttemptStore, AttemptsBusy, attemptErrors, attemptStore, type Change, SlidingLimit } from "./attempts";
import { authAsError, bodyOf } from "./body";
import { ipKey } from "./ip";

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
  captcha: new ApiError(
    429,
    "captcha_required",
    undefined,
    "Muitas tentativas erradas neste login. Confirme que você não é um robô para tentar de novo.",
  ),
  captchaFailed: new ApiError(
    429,
    "captcha_failed",
    undefined,
    "Não conseguimos confirmar a verificação. Tente entrar de novo daqui a pouco.",
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
 * instâncias, AD-063).
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
    return this.store.update<LockState, string | "blocked" | "busy">(
      `lockout:${key}`,
      now,
      (state) => {
        const s = this.current(state, now);
        if (s.blockedUntil !== null) return this.save(s, "blocked");
        if (s.failures + s.pending.length >= this.options.max) return this.save(s, "busy");
        const id = randomUUID();
        return this.save({ ...s, pending: [...s.pending, { id, at: now }] }, id);
      },
      { refusable: true },
    );
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

// AD-064: o IP que a API pôs no pedido (`webRequest`), com IPv6 pelo bloco /64. Sem IP (a conexão caiu no
// meio do pedido), todos esses dividem uma contagem.
function clientIp(ctx: HookCtx): string | undefined {
  return ctx.request instanceof Request ? (ctx.request.headers.get("x-forwarded-for") ?? undefined) : undefined;
}

const ipOf = (ctx: HookCtx): string => ipKey(clientIp(ctx) ?? "");

/**
 * RN-ID-04 / AD-064 / AD-065: 5 senhas erradas seguidas, do mesmo login e do mesmo IP, bloqueiam esse par por 15 min
 * (acertar zera). Quem erra de propósito bloqueia só o próprio par; o dono do login, de outro IP, entra.
 * Contra quem troca de IP (VPN, botnet), há um teto por login: 30 senhas erradas numa hora, somando os
 * IPs, e o login passa a pedir captcha a todos até a hora passar. Acertar zera o par, mas não o teto:
 * quem ataca de muitos IPs não ganha 30 tentativas novas quando o dono entra. Usado pelo login do paciente (por CPF)
 * e da equipe (por município e login).
 *
 * Cada pedido reserva uma vaga no par antes de conferir a senha (pedidos em paralelo não passam todos) e,
 * no fim, solta a própria vaga; só conta quando a resposta é "senha errada". Pedido sem login ou sem senha
 * não reserva nem conta. Se o pedido cair sem resposta (o better-auth não roda o `after` em erro que
 * não é `APIError`), a reserva vence sozinha em 1 min.
 */
export function loginLockout(
  keyOf: (ctx: HookCtx) => string,
  store: AttemptStore = attemptStore,
  onError: (error: unknown) => void = (error) => attemptErrors.log(error, "contagem do login"),
  // AD-062: confere o captcha do pedido (cabeçalho `x-captcha-token`) na Cloudflare.
  captchaCheck: (ctx: HookCtx) => Promise<CaptchaResult> = (ctx) =>
    checkCaptcha(ctx.request instanceof Request ? ctx.request.headers.get(CAPTCHA_HEADER) : null, clientIp(ctx)),
) {
  // O bloqueio dura 15 min; uma reserva sem resposta vence em 1 min (a senha leva bem menos).
  const pairs = new Lockout({ max: 5, blockMs: 15 * 60_000, reservationMs: 60_000 }, store);
  // A vaga do teto vence em 1 min como a do par, se o pedido cair sem resposta; senha errada a firma.
  const ceiling = new SlidingLimit({ name: "login-ceiling", max: 30, windowMs: 60 * 60_000, pendingMs: 60_000 }, store);
  // O objeto do pedido é o mesmo no `before` e no `after`: guarda o token da reserva dele.
  const tokens = new WeakMap<object, { pair: string; ceiling: string | null }>();
  const holder = (ctx: HookCtx): object => (ctx.request as object | undefined) ?? ctx.context;
  const login = (ctx: HookCtx, scope: string) => `${scope}:${keyOf(ctx)}`;
  const pair = (ctx: HookCtx, scope: string) => `${login(ctx, scope)}|${ipOf(ctx)}`;
  // A fila da chave nesta instância está cheia: a resposta é "espere alguns segundos".
  const busyIfQueued = <T>(f: () => Promise<T>): Promise<T | "busy"> =>
    f().catch((error) => {
      if (error instanceof AttemptsBusy) return "busy" as const;
      throw error;
    });
  const refuse = (error: ApiError): never => {
    throw authAsError(error);
  };
  return {
    async before(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const body = bodyOf(ctx);
      if (!body.username || !body.password) return;
      const now = Date.now();
      // Primeiro o par: par bloqueado recusa sem tocar no teto (a enxurrada de um IP bloqueado não pesa
      // na conta) nem gastar o captcha. Depois a vaga do teto, também antes de conferir a senha: em
      // paralelo, de muitos IPs, não passam mais que as vagas que faltam.
      const r = await busyIfQueued(() => pairs.reserve(pair(ctx, scope), now));
      if (r === "blocked" || r === "busy") return refuse(REFUSALS[r]);
      const giveBack = () => pairs.release(pair(ctx, scope), r, now).catch(onError);
      const ceilingToken = await busyIfQueued(() => ceiling.reserve(login(ctx, scope), now)).catch(async (error) => {
        await giveBack();
        throw error;
      });
      if (ceilingToken === "busy") {
        await giveBack();
        return refuse(REFUSALS.busy);
      }
      // Passado o teto, só segue com o captcha resolvido (e aí não ocupa vaga: a janela já está cheia).
      // Sem token, o cliente mostra o captcha; token recusado é outro código, para o cliente não reenviar
      // sozinho em laço (a Cloudflare fora do ar recusaria todos).
      if (ceilingToken === null) {
        const sent = ctx.request instanceof Request && Boolean(ctx.request.headers.get(CAPTCHA_HEADER));
        if (!sent) {
          await giveBack();
          return refuse(REFUSALS.captcha);
        }
        const captcha = await captchaCheck(ctx);
        if (captcha !== "ok") {
          // Token inválido conta como erro no par (tokens inventados sem fim bloqueiam o IP em 5); vencido,
          // repetido ou a Cloudflare sem responder não é culpa de quem mandou e só devolve a vaga.
          if (captcha === "rejected") await pairs.fail(pair(ctx, scope), r, now).catch(onError);
          else await giveBack();
          return refuse(REFUSALS.captchaFailed);
        }
      }
      tokens.set(holder(ctx), { pair: r, ceiling: ceilingToken });
    },
    async after(ctx: HookCtx, scope = "") {
      if (ctx.path !== LOGIN) return;
      const held = tokens.get(holder(ctx));
      if (held === undefined) return;
      tokens.delete(holder(ctx));
      const k = pair(ctx, scope);
      const back = ctx.context.returned;
      const now = Date.now();
      const wrong = isAPIError(back) && back.body?.code === WRONG_PASSWORD;
      // A resposta já está pronta (a sessão pode ter sido criada): uma falha ao contar vai para o log e não
      // vira erro; a reserva do par vence sozinha em 1 min. Par e teto, cada um por si: uma falha num não
      // deixa de contar o outro. A vaga do teto só fica quando a senha estava errada.
      await Promise.all([
        (async () => {
          if (!isAPIError(back)) await pairs.reset(k, held.pair, now);
          else if (wrong) await pairs.fail(k, held.pair, now);
          else await pairs.release(k, held.pair, now);
        })().catch(onError),
        (async () => {
          // Com o captcha resolvido não houve vaga (o teto estava cheio), mas o erro conta do mesmo jeito:
          // a janela segue cheia enquanto o ataque continua.
          if (wrong) await ceiling.confirm(login(ctx, scope), held.ceiling ?? randomUUID(), now);
          else if (held.ceiling !== null) await ceiling.drop(login(ctx, scope), held.ceiling, now);
        })().catch(onError),
      ]);
    },
  };
}
