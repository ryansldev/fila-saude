"use client";

import type { CallListItem, ServiceWaitlist, SessionAllocation } from "@fila-saude/schemas/queue";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import { Notice, Selection, SidePanel } from "@/components/form";
import { PageHeader } from "@/components/page";
import { CallList } from "@/components/scheduling/call-list";
import type { Answer } from "@/components/scheduling/kinds";
import { SessionSlots } from "@/components/scheduling/session-slots";
import { SlotBars } from "@/components/scheduling/slot-bars";
import { Suggestion } from "@/components/scheduling/suggestion";
import { Button } from "@/components/ui/button";
import { ListItem } from "@/components/ui/list-item";
import { Segmented } from "@/components/ui/segmented";
import { ApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { errorMessage } from "@/lib/forms/errors";
import { pendingChecksSummary, whenInTimeZone } from "@/lib/scheduling";
import { useQuery } from "@/lib/use-query";

const MAX_IN_SEGMENTED = 4;

/**
 * Agendamento (T5.3, T5.4), caminho A do design system: as sessões privadas à esquerda, a sessão
 * escolhida à direita (vagas, alocados e a sugestão) e, no topo, quem falta ligar. Inspiração: o
 * gestor de pedidos do iFood — bater o olho e saber o que fazer agora.
 */
export default function Scheduling() {
  const api = useApi();
  const confirm = useConfirm();
  const { current, unit } = useCurrentUnit(["allocate_confirm_refuse_for_patient"]);
  const timeZone = unit?.timeZone ?? "America/Sao_Paulo";
  const list = useQuery<ServiceWaitlist[]>(current ? `/v1/panel/units/${current}/waitlist` : null, 30_000);
  const callList = useQuery<CallListItem[]>(current ? `/v1/panel/units/${current}/call-list` : null, 30_000);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const allocation = useQuery<SessionAllocation>(
    sessionId ? `/v1/panel/sessions/${sessionId}/allocation` : null,
    10_000,
  );
  const [notice, setNotice] = useState<{ text: string; kind: "error" | "ok" } | null>(null);
  const [sending, setSending] = useState(false);
  const [seeCallList, setSeeCallList] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const services = (list.detail ?? []).filter((s) => s.service.mode !== "regulated");
  const service = services.find((s) => s.service.id === serviceId) ?? null;

  // Primeiro o serviço com mais alertas; depois a primeira sessão. Trocar de unidade recomeça.
  useEffect(() => {
    if (!list.detail || services.some((s) => s.service.id === serviceId)) return;
    setServiceId([...services].sort((a, b) => b.alerts - a.alerts)[0]?.service.id ?? null);
  }, [list.detail, services, serviceId]);
  useEffect(() => {
    if (!service) return setSessionId(null);
    if (service.sessions.some((s) => s.id === sessionId)) return;
    setSessionId(service.sessions[0]?.id ?? null);
  }, [service, sessionId]);

  function updateEverything() {
    allocation.reload();
    callList.reload();
    list.reload();
  }

  async function allocate(entryId: string, name: string) {
    setSending(true);
    try {
      allocation.setDetail(await api.post<SessionAllocation>(`/v1/panel/sessions/${sessionId}/allocate`, { entryId }));
      setNotice({ text: `${name} alocada. O app pede a confirmação; se não responder, ligue.`, kind: "ok" });
      callList.reload();
      list.reload();
    } catch (e) {
      // I7: outro agendador mexeu antes; a resposta traz a vista atualizada.
      const fresh = e instanceof ApiError ? (e.data?.allocation as SessionAllocation | undefined) : undefined;
      if (fresh) allocation.setDetail(fresh);
      setNotice({ text: errorMessage(e), kind: "error" });
    } finally {
      setSending(false);
    }
  }

  async function answer(entryId: string, name: string, answer: Answer) {
    if (
      answer === "refused" &&
      !(await confirm({
        title: `${name} recusou?`,
        description: "A vaga fica livre e a pessoa volta para a lista com a data de entrada de antes.",
        action: "Registrar recusa",
        danger: true,
      }))
    )
      return;
    setSending(true);
    try {
      await api.post(`/v1/panel/entries/${entryId}/answer`, { answer });
      const texts: Record<Answer, string> = {
        confirmed: `${name} confirmou.`,
        refused: "Recusa registrada. A vaga está livre.",
        no_contact: "Tentativa anotada. Tente de novo mais tarde.",
      };
      setNotice({ text: texts[answer], kind: "ok" });
      updateEverything();
    } catch (e) {
      setNotice({ text: errorMessage(e), kind: "error" });
    } finally {
      setSending(false);
    }
  }

  const pendingChecks = pendingChecksSummary(callList.detail ?? [], now);
  const [highlight, ...rest] = pendingChecks ? pendingChecks.text.split(" · ") : [];
  const d = allocation.detail;
  const serviceOptions = services.map((s) => ({
    id: s.service.id,
    label: `${s.service.name} · ${s.waiting}${s.alerts > 0 ? ` · ${s.alerts} alerta${s.alerts > 1 ? "s" : ""}` : ""}`,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Agendamento"
        description={[unit?.name, service?.service.name].filter(Boolean).join(" · ") || "Lista de espera"}
        actions={
          services.length > MAX_IN_SEGMENTED ? (
            <Selection
              className="w-72"
              value={serviceId ?? ""}
              onChange={(id) => id && setServiceId(id)}
              options={serviceOptions.map((o) => ({ value: o.id, label: o.label }))}
            />
          ) : services.length > 1 ? (
            <Segmented label="Serviço" options={serviceOptions} current={serviceId ?? ""} change={setServiceId} />
          ) : null
        }
      />
      <Notice text={notice?.text ?? list.error ?? allocation.error ?? callList.error} kind={notice?.kind ?? "error"} />

      {pendingChecks ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <span>
            <strong>{highlight}</strong> · {rest.join(" · ")}
          </span>
          <Button size="compact" variant="secondary" onClick={() => setSeeCallList(true)}>
            Ver lista de ligação
          </Button>
        </div>
      ) : null}

      {list.detail && services.length === 0 ? (
        <p className="text-slate-600">Nenhum serviço com lista de espera nesta unidade.</p>
      ) : null}

      {service ? (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <h2 className="px-4 pt-4 pb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Sessões privadas
            </h2>
            {service.sessions.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-600">
                Nenhuma sessão privada planejada. Crie uma em Sessões para alocar a lista.
              </p>
            ) : (
              service.sessions.map((s) => {
                const free = s.slots === null ? null : Math.max(0, s.slots - s.taken);
                return (
                  <ListItem key={s.id} selected={s.id === sessionId} onClick={() => setSessionId(s.id)}>
                    <span className="font-bold text-slate-900">{whenInTimeZone(s.start, timeZone)}</span>
                    {s.professional ? <span className="text-sm text-slate-500">{s.professional}</span> : null}
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <SlotBars slots={s.slots} taken={s.taken} confirmed={s.confirmed} pending={s.pending} />
                      <span className="text-xs text-slate-500">
                        {free === null ? "" : free === 1 ? "1 livre" : `${free} livres`}
                      </span>
                    </span>
                  </ListItem>
                );
              })
            )}
          </section>
          <div className="flex flex-col gap-4">
            {d ? (
              <>
                <SessionSlots d={d} timeZone={timeZone} sending={sending} answer={answer} />
                <Suggestion d={d} sending={sending} allocate={allocate} />
              </>
            ) : service.sessions.length > 0 ? (
              <p className="text-slate-600">Carregando a sessão…</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <SidePanel
        open={seeCallList}
        onClose={() => setSeeCallList(false)}
        title="Lista de ligação"
        description="Quem foi alocado e ainda não respondeu, pela sessão mais próxima. Ligue e registre a resposta."
      >
        <CallList items={callList.detail ?? []} timeZone={timeZone} sending={sending} answer={answer} />
      </SidePanel>
    </div>
  );
}
