import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export type FilterOption<T extends string> = {
  id: T;
  label: string;
  /** Número ou estado curto ao lado do rótulo ("4", "abre às 13:00"), em peso menor: sem "·". */
  detail?: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

/**
 * Pílulas de escolha do design system (uma por vez): no lugar de um menu suspenso quando a escolha tem
 * mais de uma informação. A escolhida fica cheia no azul do kit, com o relevo leve do painel.
 */
export function Filters<T extends string>({
  label,
  options,
  current,
  change,
}: {
  label: string;
  options: FilterOption<T>[];
  current: T;
  change: (id: T) => void;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(({ id, label: r, detail, icon: Icon, disabled }) => {
        const chosen = id === current;
        return (
          <label
            key={id}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border-2 border-b-[3px] px-3.5 text-sm font-bold transition-colors",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ds-action)]",
              chosen
                ? "border-[var(--ds-action)] border-b-[var(--ds-action-shadow)] bg-[var(--ds-action)] text-white"
                : "border-[var(--ds-line)] bg-white text-slate-800 hover:border-slate-300",
              disabled && "cursor-not-allowed opacity-45",
            )}
          >
            <input
              type="radio"
              name={name}
              value={id}
              checked={chosen}
              disabled={disabled}
              onChange={() => !disabled && change(id)}
              className="sr-only"
            />
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            <span>{r}</span>
            {detail ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-extrabold",
                  chosen ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {detail}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
