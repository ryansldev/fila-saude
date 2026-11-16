import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Campo de busca do design system: lupa à esquerda, limpar à direita (e Esc limpa). */
export function Busca({
  valor,
  aoMudar,
  placeholder,
  rotulo,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  rotulo: string;
}) {
  return (
    <div className="relative w-full sm:w-80">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        aria-label={rotulo}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") aoMudar("");
        }}
        className="h-10 w-full rounded-[10px] border-2 border-[var(--ds-linha)] bg-white pr-10 pl-9 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus-visible:border-[var(--ds-acao)] [&::-webkit-search-cancel-button]:hidden"
      />
      {valor ? (
        <Button
          variante="texto"
          tamanho="icone"
          icone={XIcon}
          aria-label="Limpar busca"
          title="Limpar busca"
          onClick={() => aoMudar("")}
          className="absolute top-1 right-1"
        />
      ) : null}
    </div>
  );
}
