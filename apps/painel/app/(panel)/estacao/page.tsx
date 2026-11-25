"use client";

import type { ApiRiskLevel, StationCommand, StationOperation, TodayInUnit } from "@fila-saude/schemas/queue";
import { ClockIcon, StethoscopeIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import { Notice } from "@/components/form";
import { PageHeader } from "@/components/page";
import { StationPanel } from "@/components/station/station-panel";
import { Button } from "@/components/ui/button";
import { StationCard } from "@/components/ui/station-card";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { errorMessage } from "@/lib/forms/errors";
import { stationsItOperates } from "@/lib/queue";
import { useMe } from "@/lib/session";
import { closeConfirm, closingFromError, noticeText } from "@/lib/station";
import { useQuery } from "@/lib/use-query";

const KEY = "fila-painel:estacao";

function readStation(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Estação de chamada (T3.7): um paciente por vez; a tolerância só avisa (AD-006). */
const NO_PROFILES: never[] = [];

export default function Station() {
  const api = useApi();
  const confirm = useConfirm();
  const { current } = useCurrentUnit(["operate_calls"]);
  const me = useMe();
  const today = useQuery<TodayInUnit>(current ? `/v1/panel/units/${current}/today` : null, 60_000);
  const [stationId, setStationId] = useState<string | null>(null);
  const stationIdRef = useRef(stationId);
  stationIdRef.current = stationId;
  const op = useQuery<StationOperation>(stationId ? `/v1/panel/stations/${stationId}/operation` : null, 3_000);
  const [notice, setNotice] = useState<{ text: string; kind: "error" | "ok" } | null>(null);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Cor escolhida na triagem para quem está na sala; volta a nada a cada novo chamado e a cada mudança de
  // fase (desfazer o Compareceu, rechamar): uma cor de antes não pode ir junto sem ninguém escolher.
  const [color, setColor] = useState<ApiRiskLevel | null>(null);
  const inCall = op.detail?.called;
  const calledKey = inCall ? `${inCall.itemId}:${inCall.showedUpAt ?? ""}:${inCall.calledAt}` : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `calledKey` é o gatilho.
  useEffect(() => {
    setColor(null);
  }, [calledKey]);

  // PD-46: só as estações que o perfil opera nesta unidade.
  const profiles = me.state === "authenticated" ? me.me.profiles : NO_PROFILES;
  const stations = useMemo(
    () => (current ? stationsItOperates(today.detail?.stations ?? [], profiles, current) : []),
    [current, today.detail, profiles],
  );
  // Trocou de unidade: larga a estação (e o aviso) da anterior na hora, sem esperar a lista nova.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `current` é o gatilho.
  useEffect(() => {
    setStationId(null);
    setNotice(null);
  }, [current]);
  useEffect(() => {
    if (!today.detail) return;
    if (stations.some((e) => e.id === stationId)) return;
    // Outra unidade (ou estação removida): nunca continuar chamando na estação anterior.
    const stored = readStation();
    setStationId(stations.find((e) => e.id === stored)?.id ?? stations[0]?.id ?? null);
  }, [today.detail, stations, stationId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function chooseStation(id: string) {
    setStationId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // vale só nesta página
    }
  }

  async function command(c: StationCommand, refer = false) {
    // RN-EST-07: fechar é de verdade (a pausa é que é passageira), então confirma; a última aberta confirma o fim.
    const closing = op.detail?.station.closing ?? null;
    if (
      c === "close" &&
      !(await confirm({ ...closeConfirm(op.detail?.station.name ?? "a estação", closing), danger: true }))
    )
      return;
    if (
      c === "no-show" &&
      !(await confirm({ title: "Marcar que o paciente não compareceu?", action: "Não compareceu", danger: true }))
    )
      return;
    // H3: na triagem, quem sai do chamado sai com a cor. Vermelho vai ao 1º lugar do atendimento;
    // encaminhar à emergência é a ação à parte, com confirmação (AD-059).
    const classifies = triage && Boolean(called) && (c === "call" || c === "finish");
    if (
      refer &&
      !(await confirm({
        title: "Encaminhar à emergência?",
        description: "A pessoa sai da fila de hoje desta unidade. Use quando ela precisa ir para outro serviço.",
        action: "Encaminhar",
        danger: true,
      }))
    )
      return;
    setSending(true);
    const asked = stationId;
    try {
      const body =
        classifies && color
          ? { confirmedRisk: color, ...(refer ? { refer: true } : {}) }
          : c === "close" && closing !== null
            ? { confirmed: true }
            : {};
      const r = await api.post<StationOperation>(`/v1/panel/stations/${asked}/${c}`, body);
      // Trocou de estação durante o pedido: a resposta é da anterior e não vai para a tela.
      if (stationIdRef.current !== asked) return;
      op.setDetail(r);
      // "Chamar o próximo" sem ninguém que esta estação possa chamar, ou a sessão que encerrou: diz o que houve.
      setNotice(noticeText(r.notice));
    } catch (e) {
      setNotice({ text: errorMessage(e), kind: "error" });
      // Outra estação fechou antes: o próximo toque já mostra a confirmação certa e manda `confirmed`.
      const now = closingFromError(e);
      const shown = op.detail;
      if (now !== null && shown && stationIdRef.current === asked) {
        op.setDetail({ ...shown, station: { ...shown.station, closing: now } });
      }
    } finally {
      setSending(false);
    }
  }

  const d = op.detail;
  // Diferença entre o relógio do servidor e o deste computador, medida na última resposta.
  const [deviation, setDeviation] = useState(0);
  useEffect(() => {
    if (d?.now) setDeviation(Date.parse(d.now) - Date.now());
  }, [d?.now]);
  const called = d?.called ?? null;
  const triage = d?.station.stage === "triage";
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader title="Estação" />
          {d?.session ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary">
              <StethoscopeIcon className="size-3.5" aria-hidden />
              {d.session.service}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d?.session && d.station.closedAt === null ? (
            <Button
              variant="dangerText"
              size="compact"
              disabled={sending || called !== null}
              title={called !== null ? "Finalize o atendimento antes." : undefined}
              onClick={() => command("close")}
            >
              Fechar a estação
            </Button>
          ) : null}
          <StationCard stations={stations} current={stationId} onChoose={chooseStation} />
        </div>
      </div>
      <Notice
        text={op.error ?? today.error ?? notice?.text ?? null}
        kind={op.error || today.error ? "error" : (notice?.kind ?? "error")}
      />
      {today.detail && stations.length === 0 ? (
        <p className="text-gray-600">Nenhuma estação que você opere nesta unidade.</p>
      ) : null}
      {d ? (
        d.session === null ? (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <ClockIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-extrabold text-slate-900">Nenhuma sessão aberta nesta estação</p>
              <p className="text-sm text-slate-600">Quando a recepção abrir a sessão, a fila aparece aqui.</p>
            </div>
          </div>
        ) : (
          <StationPanel
            op={d}
            color={color}
            onChooseColor={setColor}
            onCommand={command}
            sending={sending}
            now={now + deviation}
          />
        )
      ) : null}
    </div>
  );
}
