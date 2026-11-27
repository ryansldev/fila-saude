"use client";

import { type Action, can, type Profile } from "@fila-saude/domain";
import type { SignalAlertOutput } from "@fila-saude/schemas/unit";
import { WifiOffIcon } from "lucide-react";
import { signalBand } from "@/lib/signal";
import { useQuery } from "@/lib/use-query";

/** Quem tem alguma ação da fila na unidade (recepção, admin, estações) vê a faixa, como a API confere. */
const QUEUE_ACTIONS: Action[] = ["open_cancel_close_session", "verify_and_mark_attendance", "operate_calls"];

/** QP2: a faixa no topo de todas as telas do painel da unidade quando a TV ou uma estação perde o sinal. */
export function SignalBand({ unitId, profiles }: { unitId: string | null; profiles: Profile[] }) {
  const sees = unitId !== null && QUEUE_ACTIONS.some((a) => can(profiles, a));
  const { detail, error } = useQuery<SignalAlertOutput[]>(
    sees ? `/v1/panel/units/${unitId}/signal-alerts` : null,
    30_000,
  );
  // Com a consulta falhando, o último resultado já não vale: sem faixa (nem um alerta velho, nem um "tudo certo").
  const band = error ? null : signalBand(detail ?? [], Date.now());
  if (!band) return null;
  const danger = band.tone === "danger";
  return (
    <div
      role="alert"
      className={`mb-6 flex items-start gap-3 rounded-2xl border-2 border-b-4 px-4 py-3 ${
        danger ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"
      }`}
    >
      <WifiOffIcon className={`mt-0.5 size-5 shrink-0 ${danger ? "text-red-700" : "text-amber-700"}`} aria-hidden />
      <div className="flex min-w-0 flex-col">
        <p className={`font-extrabold ${danger ? "text-red-950" : "text-amber-950"}`}>{band.title}</p>
        <p className={`text-sm ${danger ? "text-red-900" : "text-amber-900"}`}>{band.text}</p>
      </div>
    </div>
  );
}
