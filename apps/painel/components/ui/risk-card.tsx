import { ClockIcon } from "lucide-react";
import type { TriageColor } from "@/lib/triage";
import { cn } from "@/lib/utils";

/**
 * Uma cor da classificação de risco: cartão claro com a borda e a bolinha da cor; marcado, pinta
 * inteiro (a bolinha fica branca). `sugerida` põe o selo "app sugeriu".
 */
export function RiskCard({
  color,
  selected,
  suggested,
  onClick,
}: {
  color: TriageColor;
  selected: boolean;
  suggested: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex min-h-20 flex-col items-start gap-0.5 rounded-xl border-2 border-b-4 px-3 py-2.5 text-left transition",
        "active:translate-y-px active:border-b-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-action)]",
        selected ? color.tone.full : cn("bg-white text-slate-900 hover:bg-slate-50", color.tone.border),
      )}
    >
      {suggested ? (
        <span className="absolute -top-2.5 right-2 rounded-full bg-slate-900 px-2 text-[11px] font-extrabold text-white">
          app sugeriu
        </span>
      ) : null}
      <span className="flex items-center gap-1.5 font-extrabold">
        <span
          className={cn("size-2.5 rounded-full", selected ? "bg-white ring-2 ring-black/25" : color.tone.dot)}
          aria-hidden
        />
        {color.label}
      </span>
      <span className={cn("text-xs", selected ? "" : "text-slate-600")}>{color.description.toLowerCase()}</span>
      <span className={cn("flex items-center gap-1 text-xs", selected ? "" : "text-slate-600")}>
        <ClockIcon className="size-3" aria-hidden />
        {color.targetTime}
      </span>
    </button>
  );
}
