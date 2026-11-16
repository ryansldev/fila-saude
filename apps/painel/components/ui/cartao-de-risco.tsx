import { ClockIcon } from "lucide-react";
import type { CorDaTriagem } from "@/lib/triagem";
import { cn } from "@/lib/utils";

/**
 * Uma cor da classificação de risco: cartão claro com a borda e a bolinha da cor; marcado, pinta
 * inteiro (a bolinha fica branca). `sugerida` põe o selo "app sugeriu".
 */
export function CartaoDeRisco({
  cor,
  selecionado,
  sugerida,
  onClick,
}: {
  cor: CorDaTriagem;
  selecionado: boolean;
  sugerida: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      className={cn(
        "relative flex min-h-20 flex-col items-start gap-0.5 rounded-xl border-2 border-b-4 px-3 py-2.5 text-left transition",
        "active:translate-y-px active:border-b-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
        selecionado ? cor.tom.cheio : cn("bg-white text-slate-900 hover:bg-slate-50", cor.tom.borda),
      )}
    >
      {sugerida ? (
        <span className="absolute -top-2.5 right-2 rounded-full bg-slate-900 px-2 text-[11px] font-extrabold text-white">
          app sugeriu
        </span>
      ) : null}
      <span className="flex items-center gap-1.5 font-extrabold">
        <span
          className={cn("size-2.5 rounded-full", selecionado ? "bg-white ring-2 ring-black/25" : cor.tom.bolinha)}
          aria-hidden
        />
        {cor.rotulo}
      </span>
      <span className={cn("text-xs", selecionado ? "" : "text-slate-600")}>{cor.descricao.toLowerCase()}</span>
      <span className={cn("flex items-center gap-1 text-xs", selecionado ? "" : "text-slate-600")}>
        <ClockIcon className="size-3" aria-hidden />
        {cor.tempoAlvo}
      </span>
    </button>
  );
}
