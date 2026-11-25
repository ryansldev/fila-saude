"use client";

import { useEffect, useState } from "react";
import { Notice, SidePanel } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { type BackChoice, backText, pauseActionText, pauseBack, pauseStartText } from "@/lib/station";

const CHOICES: { id: BackChoice; label: string }[] = [
  { id: "none", label: "sem hora" },
  { id: "30", label: "30 min" },
  { id: "60", label: "1 h" },
  { id: "at", label: "horário" },
];

type Back = { at: string } | { inMin: number } | null;

/**
 * RN-EST-06: "Pausar a estação". Diz quando a pausa começa (agora, ou depois do prazo de quem está a caminho) e
 * deixa escolher a volta, opcional.
 */
export function PausePanel({
  open,
  onClose,
  startsAt,
  timeZone,
  now,
  sending,
  error: refused,
  onPause,
}: {
  open: boolean;
  onClose: () => void;
  /** Quando a pausa começaria agora (`station.pauseStartsAt`). */
  startsAt: string;
  timeZone: string;
  now: number;
  sending: boolean;
  /** A recusa da API ao pausar: aparece aqui, porque o painel cobre o aviso da página. */
  error: string | null;
  onPause: (back: Back) => void;
}) {
  const [choice, setChoice] = useState<BackChoice>("none");
  const [time, setTime] = useState("");
  const [tried, setTried] = useState(false);
  // Cada abertura começa do zero: uma volta escolhida antes não vai junto sem ninguém ver.
  useEffect(() => {
    if (!open) return;
    setChoice("none");
    setTime("");
    setTried(false);
  }, [open]);
  const back = pauseBack(choice, time, startsAt, timeZone);
  const error = "error" in back ? back.error : null;
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Pausar a estação"
      action={pauseActionText(startsAt, now, timeZone)}
      sending={sending}
      onSend={() => {
        setTried(true);
        if (!("error" in back)) onPause(back.back);
      }}
    >
      <Notice text={refused} />
      <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-slate-700">
        {pauseStartText(startsAt, now, timeZone)}
      </p>
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-slate-900">Volta (opcional)</span>
        <Segmented label="Volta" options={CHOICES} current={choice} change={setChoice} />
        {choice === "at" ? (
          <Input
            type="time"
            aria-label="Horário da volta"
            className="w-36"
            value={time}
            aria-invalid={error !== null && (tried || time !== "")}
            onChange={(e) => setTime(e.target.value)}
          />
        ) : null}
        <p className={error && (tried || time !== "") ? "text-sm text-red-700" : "text-sm text-slate-600"}>
          {error ?? backText("until" in back ? back.until : null, timeZone)}
        </p>
      </div>
    </SidePanel>
  );
}
