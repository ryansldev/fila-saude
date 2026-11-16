import { cn } from "@/lib/utils";

/**
 * Abas lado a lado (mesmo nome e forma do `Segmentado` do app): a escolhida fica cheia, com o
 * relevo leve do painel.
 */
export function Segmentado<T extends string>({
  opcoes,
  atual,
  mudar,
  rotulo,
}: {
  opcoes: { id: T; rotulo: string }[];
  atual: T;
  mudar: (id: T) => void;
  rotulo: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {opcoes.map((o) => {
        const ativa = o.id === atual;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => mudar(o.id)}
            className={cn(
              "min-h-8 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
              ativa
                ? "border-2 border-b-[3px] border-[var(--ds-linha)] bg-white text-[var(--ds-acao)]"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
