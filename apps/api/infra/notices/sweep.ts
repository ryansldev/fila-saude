import { awaitedItems, comeNowNotices, leaveHomeNotices } from "@fila-saude/domain";
import { PUSH_CHANNEL } from "@fila-saude/schemas/push";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import database from "infra/database";
import { pushDevice } from "infra/database/central/schema/push";
import { entry } from "infra/database/municipal/schema/entry";
import { notice } from "infra/database/municipal/schema/notice";
import { session } from "infra/database/municipal/schema/session";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import type { TenantDb } from "infra/database/tenants";
import { noticeItem } from "infra/notices/outbox";
import { inSession } from "infra/queue/day";

export type Sending = { for: string; title: string; body: string; data: Record<string, string> };
export type SendingResult = { ok: true } | { ok: false; error: string; invalidToken?: boolean };
/** Um resultado por envio, na mesma ordem. Trocável no teste. */
export type Sender = (list: Sending[]) => Promise<SendingResult[]>;

const MAX_ATTEMPTS = 5;
const BATCH = 100;

// RN-ETA-03 / RN-ETA-06: avisos que dependem do tempo; o domínio marca no dia o "saia de casa" e
// o "venha agora" (com a hora, AD-057), e a chave da outbox impede o envio repetido. Uma varredura por município de cada vez.
async function generateTimeNotices(db: TenantDb, now: number, onError: (error: unknown) => void): Promise<void> {
  const open = await db.select({ id: session.id }).from(session).where(eq(session.state, "open"));
  // Uma transação por sessão: uma sessão com problema não derruba os avisos das outras nem
  // segura a trava de todas até o fim.
  for (const { id } of open) {
    await db
      .transaction(async (tx) => {
        const lock = await tx.execute<{ ok: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext(${`fila-saude:sweep:${id}`})) as ok`,
        );
        if (!lock.rows[0]?.ok) return;
        await inSession(tx, id, async (c) => {
          if (c.day?.state !== "open") return { result: null };
          // AD-057: o "venha agora" fica registrado no dia com a hora; o prazo de chegada conta dela.
          const come = comeNowNotices(c.day, now, { manualMode: false });
          const leave = leaveHomeNotices(come.day, now, { manualMode: false });
          // Quem já é o próximo recebe só o "venha agora".
          const events = [
            ...come.events,
            ...leave.events.filter((e) => !come.events.some((v) => v.itemId === e.itemId)),
          ];
          if (events.length === 0) return { result: null };
          return { day: leave.day, events, result: null };
        });
      })
      .catch((error) => {
        // Segue para a próxima sessão, mas registra: sem o aviso, o prazo de chegada nunca começa (AD-057).
        onError(error);
      });
  }
}

// T2.4: envia os pendentes vencidos; quem não tem aparelho registrado fica "no_device"; chamada que perdeu a hora, "stale";
// falha volta com espera crescente (2, 4, 8, 16 min) até desistir.
// Outbox: uma transação curta reserva o lote (empurra a próxima tentativa por `CLAIM_MS`, para nenhuma
// outra rodada pegá-lo), o envio à Expo acontece fora de transação e outra transação curta grava o
// resultado. Nenhuma trava fica aberta durante a chamada HTTP; se o processo cair depois do envio,
// o aviso volta só quando a reserva vence (no máximo um envio a mais, não um a cada rodada).
const CLAIM_MS = 5 * 60_000;

const CALL_KINDS = new Set(["your_turn", "recalled"]);

type NoticeRef = { id: string; kind: string; state: string; entryId: string | null; key: string };

// Chamada mais nova que ainda vale: já enviada ou pendente (no lote, em outra rodada ou esperando nova tentativa).
const LIVE = new Set(["sent", "pending"]);

/**
 * AD-074: o envio sai na hora do evento, mas um envio que falha volta minutos depois, a varredura roda em
 * paralelo e a Expo pode cair. Recebe o lote reservado e o histórico das mesmas entradas no banco (em ordem
 * de criação) e devolve as chamadas ("sua vez" e rechamadas) que perderam a hora: as seguidas de um "pulado"
 * (em qualquer estado), as seguidas de uma chamada que ainda vale e as de um item que a fila não espera mais
 * entrar na sala (`awaitedItems`: atendido, pulado, já na sala, ou chamado agora em outra etapa). Com o envio na hora, chamada e rechamada saem cada uma no seu
 * momento; só as atrasadas juntas viram uma (a última).
 */
export function staleNotices(claimed: NoticeRef[], history: NoticeRef[], awaited: Set<string>): Set<string> {
  const stale = new Set<string>();
  for (const a of claimed) {
    if (!a.entryId || !CALL_KINDS.has(a.kind)) continue;
    const item = noticeItem(a.key);
    if (!item || !awaited.has(item)) {
      stale.add(a.id);
      continue;
    }
    const same = history.filter((x) => x.entryId === a.entryId);
    const later = same.slice(same.findIndex((x) => x.id === a.id) + 1);
    if (later.some((x) => x.kind === "skipped" || (CALL_KINDS.has(x.kind) && LIVE.has(x.state)))) stale.add(a.id);
  }
  return stale;
}

/**
 * Os itens que a fila ainda espera entrar na sala, nas sessões das entradas dadas (`awaitedItems`). Lido
 * fora da trava da sessão: uma mudança da fila entre esta leitura e o envio ainda deixa sair um aviso.
 */
async function awaitedCallItems(db: TenantDb, entryIds: string[]): Promise<Set<string>> {
  if (entryIds.length === 0) return new Set();
  const sessions = db.selectDistinct({ id: entry.sessionId }).from(entry).where(inArray(entry.id, entryIds));
  const days = await db.select({ day: sessionDay.day }).from(sessionDay).where(inArray(sessionDay.sessionId, sessions));
  return new Set(days.flatMap((d) => [...awaitedItems(d.day)]));
}

/** Envia os pendentes vencidos do município (a varredura e o envio na hora do evento, AD-074). */
export async function sendPending(db: TenantDb, now: number, send: Sender): Promise<void> {
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(notice)
      .where(
        and(
          eq(notice.state, "pending"),
          lte(notice.nextAttemptAt, sql`greatest(${new Date(now).toISOString()}::timestamptz, now())`),
        ),
      )
      .orderBy(asc(notice.createdAt))
      .limit(BATCH)
      .for("update", { skipLocked: true });
    if (rows.length > 0) {
      await tx
        .update(notice)
        .set({ nextAttemptAt: new Date(Math.max(now, Date.now()) + CLAIM_MS) })
        .where(
          inArray(
            notice.id,
            rows.map((r) => r.id),
          ),
        );
    }
    return rows;
  });
  if (claimed.length === 0) return;
  const entries = [...new Set(claimed.flatMap((a) => (a.entryId && CALL_KINDS.has(a.kind) ? [a.entryId] : [])))];
  const history =
    entries.length === 0
      ? []
      : await db
          .select({ id: notice.id, kind: notice.kind, state: notice.state, entryId: notice.entryId, key: notice.key })
          .from(notice)
          .where(inArray(notice.entryId, entries))
          .orderBy(asc(notice.createdAt), asc(notice.id));
  const stale = staleNotices(claimed, history, await awaitedCallItems(db, entries));
  if (stale.size > 0)
    await db
      .update(notice)
      .set({ state: "stale" })
      .where(inArray(notice.id, [...stale]));
  const pending = claimed.filter((a) => !stale.has(a.id));
  if (pending.length === 0) return;

  const accounts = [...new Set(pending.map((a) => a.patientId))];
  const devices = await database
    .select({ patientId: pushDevice.patientId, token: pushDevice.token })
    .from(pushDevice)
    .where(inArray(pushDevice.patientId, accounts));
  const sendings: { noticeId: string; sending: Sending }[] = [];
  for (const a of pending) {
    for (const d of devices.filter((x) => x.patientId === a.patientId)) {
      sendings.push({
        noticeId: a.id,
        sending: { for: d.token, title: a.title, body: a.body, data: { kind: a.kind, entryId: a.entryId ?? "" } },
      });
    }
  }
  const results = sendings.length > 0 ? await send(sendings.map((e) => e.sending)) : [];
  const invalid = sendings.filter((_, i) => {
    const r = results[i];
    return r && !r.ok && r.invalidToken;
  });
  if (invalid.length > 0) {
    await database.delete(pushDevice).where(
      inArray(
        pushDevice.token,
        invalid.map((e) => e.sending.for),
      ),
    );
  }

  await db.transaction(async (tx) => {
    for (const a of pending) {
      const mine = sendings.map((e, i) => ({ ...e, r: results[i] })).filter((e) => e.noticeId === a.id);
      if (mine.length === 0) {
        await tx.update(notice).set({ state: "no_device" }).where(eq(notice.id, a.id));
        continue;
      }
      if (mine.some((e) => e.r?.ok)) {
        await tx
          .update(notice)
          .set({ state: "sent", sentAt: new Date(now), attempts: a.attempts + 1 })
          .where(eq(notice.id, a.id));
        continue;
      }
      const attempts = a.attempts + 1;
      const error = mine.map((e) => (e.r && !e.r.ok ? e.r.error : "sem resposta")).join("; ");
      await tx
        .update(notice)
        .set({
          attempts,
          lastError: error,
          state: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          nextAttemptAt: new Date(now + 2 ** attempts * 60_000),
        })
        .where(eq(notice.id, a.id));
    }
  });
}

export async function sweepMunicipality(
  db: TenantDb,
  now: number,
  send: Sender,
  onError: (error: unknown) => void = () => {},
): Promise<void> {
  await generateTimeNotices(db, now, onError);
  await sendPending(db, now, send);
}

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type ExpoTicket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/** A mensagem da Expo: pelo canal Android da fila (importância máxima), para a chamada aparecer em destaque. */
export const expoMessage = (e: Sending) => ({
  to: e.for,
  title: e.title,
  body: e.body,
  data: e.data,
  sound: "default",
  priority: "high",
  channelId: PUSH_CHANNEL,
});

// Sem resposta da Expo em 10 s, desiste (volta na próxima tentativa); o desligamento da API não fica preso.
const EXPO_TIMEOUT_MS = 10_000;

/** Envio pelo serviço de push da Expo, em lotes de 100 (limite da Expo), com prazo por lote. */
export const expoSenderWith =
  (timeoutMs: number): Sender =>
  async (list) => {
    const exit: SendingResult[] = [];
    for (let i = 0; i < list.length; i += 100) {
      const batch = list.slice(i, i + 100);
      try {
        const r = await fetch(EXPO_URL, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(batch.map(expoMessage)),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = (await r.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
        if (!r.ok || !body?.data) {
          exit.push(...batch.map(() => ({ ok: false as const, error: `expo ${r.status}` })));
          continue;
        }
        for (const t of body.data) {
          if (t.status === "ok") exit.push({ ok: true });
          else
            exit.push({
              ok: false,
              error: t.message ?? "erro",
              invalidToken: t.details?.error === "DeviceNotRegistered",
            });
        }
      } catch (err) {
        exit.push(...batch.map(() => ({ ok: false as const, error: err instanceof Error ? err.message : "rede" })));
      }
    }
    return exit;
  };

export const expoSender: Sender = expoSenderWith(EXPO_TIMEOUT_MS);

/**
 * PD-50: na v0.1 a varredura roda dentro do processo da API, a cada minuto, município por município.
 * Devolve a função que para o intervalo.
 */
export function startSweep(
  slugs: () => Promise<string[]>,
  database: (slug: string) => Promise<TenantDb | null>,
  log: (error: unknown, slug: string) => void,
  send: Sender = expoSender,
  intervalMs = 60_000,
): () => void {
  let running = false;
  const round = async () => {
    if (running) return;
    running = true;
    try {
      for (const slug of await slugs()) {
        const db = await database(slug);
        if (db) await sweepMunicipality(db, Date.now(), send, (e) => log(e, slug)).catch((e) => log(e, slug));
      }
    } catch (e) {
      log(e, "*");
    } finally {
      running = false;
    }
  };
  const id = setInterval(round, intervalMs);
  return () => clearInterval(id);
}
