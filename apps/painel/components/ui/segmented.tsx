import { cn } from "@/lib/utils";

/**
 * Abas lado a lado (mesmo nome e forma do `Segmentado` do app): a escolhida fica cheia, com o
 * relevo leve do painel.
 */
export function Segmented<T extends string>({
  options,
  current,
  change,
  label,
}: {
  options: { id: T; label: string }[];
  current: T;
  change: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.id === current;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => change(o.id)}
            className={cn(
              "min-h-8 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-action)]",
              active
                ? "border-2 border-b-[3px] border-[var(--ds-line)] bg-white text-[var(--ds-action)]"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
