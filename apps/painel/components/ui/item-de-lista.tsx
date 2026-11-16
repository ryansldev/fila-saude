import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Linha de uma lista que se escolhe (sessões no Agendamento): a escolhida ganha a faixa azul à esquerda. */
export function ItemDeLista({
  selecionado,
  onClick,
  children,
}: {
  selecionado: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={selecionado || undefined}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1 border-t border-slate-100 border-l-4 px-4 py-3 text-left transition-colors first:border-t-0",
        "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-[var(--ds-acao)]",
        selecionado ? "border-l-[var(--ds-acao)] bg-primary-50" : "border-l-transparent hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
