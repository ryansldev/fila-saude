"use client";

import { attendanceInputSchema, type TodayItem, type TodayQueue } from "@fila-saude/schemas/queue";
import { ArmchairIcon, CheckIcon, HouseIcon, MegaphoneIcon, StethoscopeIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAsk, useConfirm } from "@/components/dialogs";
import { Notice } from "@/components/form";
import { PageHeader, SessionState } from "@/components/page";
import { QueueGroup } from "@/components/queue/queue-group";
import { QueueRow } from "@/components/queue/queue-row";
import { Button } from "@/components/ui/button";
import { Filters } from "@/components/ui/filters";
import { Search } from "@/components/ui/search";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { errorMessage, validateClient } from "@/lib/forms/errors";
import { emptyQueue, groupQueue, queueActions, searchQueue, sessionPill, validFilter } from "@/lib/queue";
import { useMe } from "@/lib/session";
import { useQuery } from "@/lib/use-query";

const FILTER_KEY = "fila-painel:filtro-da-fila";

function readFilter(): string | null {
  try {
    return localStorage.getItem(FILTER_KEY);
  } catch {
    return null;
  }
}

/**
 * Fila do dia (caminho C do design system): a unidade inteira numa fila só, para a recepção no
 * balcão — busca por nome, senha ou CPF, pílulas por serviço e, em cada linha, há quanto tempo a
 * pessoa espera. Abrir e encerrar sessão só aparece com um serviço escolhido.
 */
export default function DayQueue() {
  const api = useApi();
  const confirm = useConfirm();
  const ask = useAsk();
  const me = useMe();
  const { current, unit } = useCurrentUnit([
    "open_cancel_close_session",
    "verify_and_mark_attendance",
    "operate_calls",
  ]);
  const timeZone = unit?.timeZone ?? "America/Sao_Paulo";
  const queue = useQuery<TodayQueue>(current ? `/v1/panel/units/${current}/today-queue` : null, 3_000);
  const [filter, setFilter] = useState<string>("todas");
  const [term, setTerm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  // O aviso é da unidade em que aconteceu: trocar de unidade o apaga.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `current` é o gatilho.
  useEffect(() => setNotice(null), [current]);

  const sessions = queue.detail?.sessions ?? [];
  // O filtro guardado só vale se a sessão ainda está entre as de hoje.
  useEffect(() => {
    if (!queue.detail) return;
    const today = queue.detail.sessions;
    setFilter((f) => (f !== "todas" && today.some((s) => s.id === f) ? f : validFilter(readFilter(), today)));
  }, [queue.detail]);

  function chooseFilter(id: string) {
    setFilter(id);
    try {
      localStorage.setItem(FILTER_KEY, id);
    } catch {
      // vale só nesta página
    }
  }

  const profiles = me.state === "authenticated" ? me.me.profiles : [];
  const session = sessions.find((s) => s.id === filter) ?? null;
  const can = (state: Parameters<typeof queueActions>[2]) =>
    current ? queueActions(profiles, current, state) : { open: false, close: false, attendance: false };
  const canAttendance = can("open").attendance;
  const now = queue.detail ? Date.parse(queue.detail.now) : Date.now();

  async function act(path: string, body: unknown, question?: Parameters<typeof confirm>[0]) {
    if (question && !(await confirm(question))) return;
    try {
      await api.post(path, body);
      setNotice(null);
      queue.reload();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }

  async function attendance(i: TodayItem, body: { result: "matches" | "does_not_match"; reason?: string }) {
    const request = { entryId: i.entryId, ...body };
    const invalid = validateClient(attendanceInputSchema, request);
    if (invalid) return setNotice(invalid.general ?? Object.values(invalid.fields)[0] ?? "Confira os dados.");
    await act(`/v1/panel/sessions/${i.sessionId}/attendance`, request);
  }

  async function notMatches(i: TodayItem) {
    // AD-039: recusar tira da fila de hoje, sem falta; sempre com motivo.
    const reason = await ask({
      title: "Documentos não conferem",
      description: "A pessoa sai da fila de hoje, sem falta.",
      label: "Motivo",
      action: "Não confere",
    });
    if (reason) await attendance(i, { result: "does_not_match", reason });
  }

  const fromFilter = (queue.detail?.items ?? []).filter((i) => filter === "todas" || i.sessionId === filter);
  const found = searchQueue(fromFilter, term);
  const g = groupQueue(found);
  const totalInQueue = sessions.reduce((n, s) => n + s.counts.inQueue, 0);
  const options = [
    { id: "todas", label: "Todas", detail: String(totalInQueue) },
    ...sessions.map((s) => ({ id: s.id, icon: StethoscopeIcon, ...sessionPill(s, timeZone) })),
  ];

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Fila do dia"
        description={unit?.name}
        actions={
          <Search label="Buscar na fila" placeholder="Buscar nome, senha ou CPF" value={term} onChange={setTerm} />
        }
      />
      <Notice text={notice ?? queue.error} />

      {queue.detail && sessions.length === 0 ? (
        <p className="text-slate-600">Nenhuma sessão hoje nesta unidade.</p>
      ) : null}

      {sessions.length > 0 ? (
        <Filters label="Serviço" options={options} current={filter} change={chooseFilter} />
      ) : null}

      {session && (can(session.state).open || can(session.state).close) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <SessionState state={session.state} />
          <span className="text-sm text-slate-700">
            <strong>{session.taken}</strong>
            {session.slots === null ? " inscritos" : ` de ${session.slots} vagas ocupadas`}
          </span>
          {session.reserve > 0 ? <span className="text-sm text-slate-500">{session.reserve} na reserva</span> : null}
          <div className="flex-1" />
          {can(session.state).open ? (
            <Button
              size="compact"
              onClick={() =>
                act(`/v1/panel/sessions/${session.id}/open`, {}, { title: "Abrir a sessão agora?", action: "Abrir" })
              }
            >
              Abrir sessão
            </Button>
          ) : null}
          {can(session.state).close ? (
            <Button
              size="compact"
              variant="outlineDanger"
              onClick={() =>
                act(
                  `/v1/panel/sessions/${session.id}/close`,
                  {},
                  {
                    title: "Encerrar a sessão?",
                    description: "Quem ainda está na fila vai ser remanejado ou levar falta.",
                    action: "Encerrar",
                    danger: true,
                  },
                )
              }
            >
              Encerrar sessão
            </Button>
          ) : null}
        </div>
      ) : null}

      {sessions.length > 0 && fromFilter.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
          {emptyQueue(session ? [session] : sessions, timeZone, !session && can("planned").open)}
        </div>
      ) : null}
      {fromFilter.length > 0 && found.length === 0 ? (
        <p className="text-slate-600">Ninguém com &quot;{term.trim()}&quot; na fila de hoje.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        <QueueGroup title="Esperando a recepção" icon={TriangleAlertIcon} total={g.reception.length} tone="alert">
          {g.reception.map((i) => (
            <QueueRow
              key={i.id}
              i={i}
              now={now}
              document={canAttendance}
              actions={
                canAttendance ? (
                  <>
                    <Button size="compact" variant="dangerText" onClick={() => notMatches(i)}>
                      Não confere
                    </Button>
                    <Button size="compact" variant="success" onClick={() => attendance(i, { result: "matches" })}>
                      Confere, marcar presença
                    </Button>
                  </>
                ) : null
              }
            />
          ))}
        </QueueGroup>
        <QueueGroup title="Chamado agora" icon={MegaphoneIcon} total={g.called.length} tone="called">
          {g.called.map((i) => (
            <QueueRow key={i.id} i={i} now={now} document={false} />
          ))}
        </QueueGroup>
        <QueueGroup title="Na unidade" icon={ArmchairIcon} total={g.inUnit.length}>
          {g.inUnit.map((i) => (
            <QueueRow key={i.id} i={i} now={now} document={false} />
          ))}
        </QueueGroup>
        <QueueGroup title="A caminho" icon={HouseIcon} total={g.onTheWay.length}>
          {g.onTheWay.map((i) => (
            <QueueRow
              key={i.id}
              i={i}
              now={now}
              document={canAttendance}
              actions={
                canAttendance ? (
                  <Button size="compact" variant="secondary" onClick={() => attendance(i, { result: "matches" })}>
                    Marcar presença
                  </Button>
                ) : null
              }
            />
          ))}
        </QueueGroup>
        <QueueGroup title="Atendidos e encerrados" icon={CheckIcon} total={g.closed.length} collapsed>
          {g.closed.map((i) => (
            <QueueRow key={i.id} i={i} now={now} document={false} />
          ))}
        </QueueGroup>
      </div>
    </div>
  );
}
