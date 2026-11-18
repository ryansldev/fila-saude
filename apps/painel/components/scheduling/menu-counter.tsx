"use client";

import type { CallListItem } from "@fila-saude/schemas/queue";
import { useEffect } from "react";
import { useCurrentUnit } from "@/lib/current-unit";
import { CALL_LIST_CHANGED } from "@/lib/scheduling";
import { useQuery } from "@/lib/use-query";

/** Quantas pessoas falta ligar na unidade escolhida (a cada 60 s); some com zero. */
export function MenuCounter({ active }: { active: boolean }) {
  const { current } = useCurrentUnit(["allocate_confirm_refuse_for_patient"]);
  const callList = useQuery<CallListItem[]>(current ? `/v1/panel/units/${current}/call-list` : null, 60_000);
  const { reload } = callList;
  useEffect(() => {
    window.addEventListener(CALL_LIST_CHANGED, reload);
    return () => window.removeEventListener(CALL_LIST_CHANGED, reload);
  }, [reload]);
  const total = callList.detail?.length ?? 0;
  if (total === 0) return null;
  return (
    <span
      className={`ml-auto rounded-full px-2 text-xs font-extrabold ${active ? "bg-white text-primary" : "bg-amber-400 text-slate-950"}`}
      title={total === 1 ? "1 pessoa para ligar" : `${total} pessoas para ligar`}
    >
      {total}
    </span>
  );
}
