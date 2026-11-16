import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpcaoDeFiltro<T extends string> = {
  id: T;
  rotulo: string;
  /** Número ou estado curto ao lado do rótulo ("4", "abre às 13:00"), em peso menor: sem "·". */
  detalhe?: string;
  icone?: LucideIcon;
  desativada?: boolean;
};

/**
 * Pílulas de escolha do design system (uma por vez): no lugar de um menu suspenso quando a escolha tem
 * mais de uma informação. A escolhida fica cheia no azul do kit, com o relevo leve do painel.
 */
export function Filtros<T extends string>({
  rotulo,
  opcoes,
  atual,
  mudar,
}: {
  rotulo: string;
  opcoes: OpcaoDeFiltro<T>[];
  atual: T;
  mudar: (id: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map(({ id, rotulo: r, detalhe, icone: Icone, desativada }) => {
        const escolhida = id === atual;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={escolhida}
            aria-disabled={desativada || undefined}
            onClick={() => !desativada && mudar(id)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border-2 border-b-[3px] px-3.5 text-sm font-bold transition-colors",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
              escolhida
                ? "border-[var(--ds-acao)] border-b-[var(--ds-acao-sombra)] bg-[var(--ds-acao)] text-white"
                : "border-[var(--ds-linha)] bg-white text-slate-800 hover:border-slate-300",
              desativada && "cursor-not-allowed opacity-45",
            )}
          >
            {Icone ? <Icone className="size-4 shrink-0" aria-hidden /> : null}
            <span>{r}</span>
            {detalhe ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-extrabold",
                  escolhida ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {detalhe}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
