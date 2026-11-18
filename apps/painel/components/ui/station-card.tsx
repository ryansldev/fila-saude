"use client";

import { ChevronDownIcon, ClipboardListIcon, StethoscopeIcon } from "lucide-react";
import { useState } from "react";
import { SidePanel } from "@/components/form";
import { cn } from "@/lib/utils";

type StationSummary = { id: string; name: string; stage: "triage" | "care" };

const STAGES = {
  triage: { label: "Triagem", Icon: ClipboardListIcon },
  care: { label: "Atendimento", Icon: StethoscopeIcon },
} as const;

/**
 * A estação em que a pessoa chama, como a unidade no menu: uma linha com o ícone da etapa e o nome;
 * com mais de uma, a troca num painel lateral com um cartão por estação.
 */
export function StationCard({
  stations,
  current,
  onChoose,
}: {
  stations: StationSummary[];
  current: string | null;
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = stations.find((e) => e.id === current);
  if (!chosen) return null;
  const several = stations.length > 1;
  const { Icon } = STAGES[chosen.stage];
  const content = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="truncate text-sm font-extrabold text-slate-900">{chosen.name}</span>
      {several ? <ChevronDownIcon className="size-4 shrink-0 text-slate-500" aria-hidden /> : null}
    </>
  );
  const cssClass =
    "flex max-w-72 items-center gap-2 rounded-xl border-2 border-b-[3px] border-[var(--ds-line)] bg-white px-2 py-1.5";
  return (
    <>
      {several ? (
        <button
          type="button"
          aria-label={`Estação: ${chosen.name}. Trocar de estação`}
          onClick={() => setOpen(true)}
          className={cn(
            cssClass,
            "transition-colors hover:border-slate-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-action)]",
          )}
        >
          {content}
        </button>
      ) : (
        <div className={cssClass}>{content}</div>
      )}
      <SidePanel open={open} onClose={() => setOpen(false)} title="Em qual estação você está?">
        <ul className="flex flex-col gap-3">
          {stations.map((e) => {
            const checked = e.id === current;
            const stage = STAGES[e.stage];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-current={checked || undefined}
                  onClick={() => {
                    onChoose(e.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 p-4 text-left transition-colors",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-action)]",
                    checked
                      ? "border-[var(--ds-action)] bg-primary-50"
                      : "border-[var(--ds-line)] bg-white hover:border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      checked ? "bg-[var(--ds-action)] text-white" : "bg-primary-50 text-primary",
                    )}
                  >
                    <stage.Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-extrabold text-slate-900">{e.name}</span>
                    <span className="text-sm text-slate-600">{stage.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </SidePanel>
    </>
  );
}
