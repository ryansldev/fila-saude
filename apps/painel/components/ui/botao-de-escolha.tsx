import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cartão que se escolhe com um toque (as cores da triagem): o mesmo relevo leve do `Button`,
 * marcado com `aria-pressed`. A cor vem de `className`; o escolhido ganha o anel.
 */
export function BotaoDeEscolha({
  selecionado,
  algumSelecionado = false,
  onClick,
  className,
  children,
}: {
  selecionado: boolean;
  /** Com outro escolhido, este fica esmaecido. */
  algumSelecionado?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      className={cn(
        "flex min-h-20 flex-col items-start justify-center rounded-[10px] border-b-[3px] border-black/20 px-4 py-3 text-left transition",
        "active:translate-y-px active:border-b-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
        selecionado ? "ring-4 ring-gray-900 ring-offset-2" : algumSelecionado ? "opacity-60" : "",
        className,
      )}
    >
      {children}
    </button>
  );
}
