import type { FastifyInstance } from "fastify";
import type { TenantDb } from "infra/database/tenants";
import { SEND_BATCH, type Sender, sendPending } from "infra/notices/sweep";

declare module "fastify" {
  interface FastifyInstance {
    /** AD-074: o envio dos push na hora do evento, por município. */
    sendNow: SendNow;
  }
}

/**
 * AD-074: o push sai logo depois do pedido que gravou o aviso (a transação já fechou quando a resposta sai).
 * A varredura de 60 s continua para as novas tentativas e os avisos do tempo ("saia de casa", "venha agora").
 */

/** Escrita que deu certo: pode ter gravado avisos na outbox (o hook só pergunta quando há município). */
export function sendsAfter(method: string, status: number): boolean {
  return status < 400 && !["GET", "HEAD", "OPTIONS"].includes(method);
}

export type SendNow = ((key: string, run: () => Promise<void>) => void) & {
  /** Espera o envio do município acabar (testes). */
  idle: (key: string) => Promise<void>;
  /** Não começa mais envios e espera os em andamento (antes de fechar os bancos). */
  close: () => Promise<void>;
};

/**
 * Um envio por município de cada vez: pedidos durante um envio viram uma rodada a mais, não uma por pedido
 * (a reserva com SKIP LOCKED já evita aviso duplicado; isto evita consultas à toa). Nunca lança.
 */
export function coalesce(log: (error: unknown, key: string) => void): SendNow {
  const running = new Map<string, Promise<void>>();
  // A rodada a mais de cada município, com o pedido mais novo (o banco dele pode ter mudado no meio).
  const next = new Map<string, () => Promise<void>>();
  let closed = false;
  const loop = async (key: string, first: () => Promise<void>) => {
    let run: (() => Promise<void>) | undefined = first;
    while (run) {
      try {
        await run();
      } catch (e) {
        log(e, key);
      }
      run = closed ? undefined : next.get(key);
      next.delete(key);
    }
    running.delete(key);
  };
  const now = ((key, run) => {
    if (closed) return;
    if (running.has(key)) {
      next.set(key, run);
      return;
    }
    running.set(key, loop(key, run));
  }) as SendNow;
  now.idle = async (key) => {
    await running.get(key);
  };
  now.close = async () => {
    closed = true;
    await Promise.all(running.values());
  };
  return now;
}

/**
 * Liga o envio na hora do evento: depois de cada escrita com município que deu certo, envia os pendentes
 * dele, sem segurar a resposta. O banco vem de `pool` pelo slug na hora do envio (o pool do pedido pode ter
 * saído do cache). Sem `send` (testes contra o servidor, scripts), não envia nada.
 */
export function sendAfterWrites(
  app: FastifyInstance,
  send: Sender | null,
  pool: (slug: string) => Promise<TenantDb | null>,
): void {
  const now = coalesce((error, slug) => app.log.error({ err: error, slug }, "envio na hora"));
  app.decorate("sendNow", now);
  if (!send) return;
  // No `onClose` os pedidos em andamento já terminaram (e dispararam o envio deles); este hook roda antes
  // do que fecha os bancos, registrado antes (o Fastify roda os `onClose` do último para o primeiro).
  app.addHook("onClose", async () => now.close());
  app.addHook("onResponse", async (req, reply) => {
    const slug = req.tenant?.slug;
    if (!slug || !sendsAfter(req.method, reply.statusCode)) return;
    now(slug, async () => {
      const db = await pool(slug);
      if (!db) return;
      // Lote cheio: pode haver mais (depois de uma queda da Expo, por exemplo); segue até esvaziar.
      let claimed = SEND_BATCH;
      while (claimed === SEND_BATCH) claimed = await sendPending(db, Date.now(), send);
    });
  });
}
