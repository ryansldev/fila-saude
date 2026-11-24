import type { Entry, Event, SessionDay } from "@fila-saude/domain";
import { inArray } from "drizzle-orm";
import { notice } from "infra/database/municipal/schema/notice";
import { station } from "infra/database/municipal/schema/station";
import type { TenantTx } from "infra/database/tenants";

type Text = { kind: string; key: string; title: string; body: string };
type Context = { unit: string; ticket: string; station: (id: string | undefined) => string };

const min = (s: string) => s.toLowerCase();

// A chave dos avisos de chamada e de tempo leva o item da fila; `noticeTarget` a lê de volta (AD-074).
const YOUR_TURN_KEY = "sua_vez";
const RECALL_KEY = "rechamada";
const LEAVE_HOME_KEY = "saia_de_casa";
const COME_NOW_KEY = "venha_agora";

export type NoticeTarget = { kind: "call"; item: string } | { kind: "waiting"; item: string; stage: string };

/**
 * O que o aviso supõe da fila, pela chave: chamada ("sua vez", rechamada) supõe o item chamado; "saia de
 * casa" e "venha agora" supõem o item esperando naquela etapa. `null` nos outros avisos.
 */
export function noticeTarget(key: string): NoticeTarget | null {
  const [prefix, item, stage] = key.split(":");
  if (!item) return null;
  if (prefix === YOUR_TURN_KEY || prefix === RECALL_KEY) return { kind: "call", item };
  if ((prefix === LEAVE_HOME_KEY || prefix === COME_NOW_KEY) && stage) return { kind: "waiting", item, stage };
  return null;
}

/**
 * T3.8 / RN-NOT-01: o que cada evento da fila diz ao paciente, só ação e local, nunca sintoma.
 * A chave identifica o evento: o mesmo evento nunca vira dois avisos.
 */
export function noticeText(ev: Event, ctx: Context): Text | null {
  const d = ev.data ?? {};
  const item = ev.itemId ?? "";
  switch (ev.kind) {
    case "called":
      return {
        kind: "your_turn",
        key: `${YOUR_TURN_KEY}:${item}:${d.at}`,
        title: `é a sua vez! senha ${ctx.ticket}`,
        body: `vá para ${min(ctx.station(ev.stationId))} na ${ctx.unit}.`,
      };
    case "recalled":
      return {
        kind: "recalled",
        key: `${RECALL_KEY}:${item}:${d.at}`,
        title: `chamando você de novo! senha ${ctx.ticket}`,
        body: `vá para ${min(ctx.station(ev.stationId))} na ${ctx.unit}.`,
      };
    case "skipped": {
      const body =
        d.for === "left_queue"
          ? "você saiu da fila de hoje. se estiver na unidade, fale com a recepção."
          : d.for === "remote"
            ? "você continua na fila. ao chegar na unidade, leia o QR de novo."
            : "você continua na fila, logo depois dos próximos. fique de olho na TV.";
      return {
        kind: "skipped",
        key: `pulado:${item}:${d.skips}`,
        title: `chamamos a senha ${ctx.ticket} e você não apareceu`,
        body,
      };
    }
    case "ticket_issued":
      // Só a senha que nasce na abertura da sessão: quem entra depois já vê a senha no app.
      if (!d.onOpening) return null;
      return {
        kind: "queue_opened",
        key: `fila_aberta:${item}`,
        title: "a fila de hoje abriu",
        body: `você está na fila da ${ctx.unit}, senha ${ctx.ticket}. fique em casa: avisamos a hora de sair.`,
      };
    case "leave_home":
      return {
        kind: "leave_home",
        key: `${LEAVE_HOME_KEY}:${item}:${d.stage}`,
        title: "hora de sair de casa",
        body: `faltam cerca de ${d.minutes} min para a sua vez na ${ctx.unit}. ao chegar, leia o QR da TV.`,
      };
    case "come_now":
      return {
        kind: "come_now",
        key: `${COME_NOW_KEY}:${item}:${d.stage}:${d.at}`, // "Vou sair" recomeça (AD-057)
        title: "venha agora",
        body: `você é o próximo na ${ctx.unit}. ao chegar, leia o QR da TV.`,
      };
    default:
      return null;
  }
}

/** Onde e quando é a sessão do evento, para os avisos que não têm item na fila (o "confirme"). */
export type NoticeLocal = { unit: string; start: Date; timeZone: string };

const when = (start: Date, timeZone: string) => {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timeZone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(start);
  const p = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `${p("weekday")}, ${p("day")}/${p("month")} às ${p("hour")}:${p("minute")}`;
};

/** RN-CONF-01 / I8: o "confirme" da alocação; uma chave por alocação (o prazo muda a cada uma). */
export function allocationText(ev: Event, local: NoticeLocal): Text | null {
  if (ev.kind !== "allocated") return null;
  return {
    kind: "confirm",
    key: `confirme:${ev.entryId}:${ev.sessionId}:${ev.data?.deadline}`,
    title: "confirme sua consulta",
    // RN-NOT-01: só a ação e o local; o serviço apareceria na tela bloqueada (ex.: "Psiquiatria").
    body: `${local.unit}, ${when(local.start, local.timeZone)}. abra o app para confirmar.`,
  };
}

// PD-49: grava os avisos dos eventos na transação da fila; quem não tem conta (balcão) não recebe push.
export async function saveNotices(
  tx: TenantTx,
  local: NoticeLocal,
  day: SessionDay | null,
  entries: Entry[],
  events: Event[],
): Promise<void> {
  if (events.length === 0) return;
  const ids = [...new Set(events.map((e) => e.stationId).filter((x): x is string => Boolean(x)))];
  const names = new Map(
    ids.length === 0
      ? []
      : (await tx.select({ id: station.id, name: station.name }).from(station).where(inArray(station.id, ids))).map(
          (e) => [e.id, e.name],
        ),
  );
  const rows: (typeof notice.$inferInsert)[] = [];
  for (const ev of events) {
    const entry = entries.find((e) => e.id === ev.entryId);
    if (!entry?.guardianId) continue;
    const allocation = allocationText(ev, local);
    if (allocation) {
      rows.push({ ...allocation, patientId: entry.guardianId, entryId: entry.id });
      continue;
    }
    const item = day?.items.find((i) => i.id === ev.itemId);
    if (!item) continue;
    const t = noticeText(ev, {
      unit: local.unit,
      ticket: item.ticket,
      station: (id) => names.get(id ?? "") ?? "",
    });
    if (t) rows.push({ ...t, patientId: entry.guardianId, entryId: entry.id });
  }
  if (rows.length > 0) await tx.insert(notice).values(rows).onConflictDoNothing({ target: notice.key });
}
