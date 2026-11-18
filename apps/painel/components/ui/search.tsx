import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Campo de busca do design system: lupa à esquerda, limpar à direita (e Esc limpa). */
export function Search({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full sm:w-80">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        className="h-10 w-full rounded-[10px] border-2 border-[var(--ds-line)] bg-white pr-10 pl-9 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus-visible:border-[var(--ds-action)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <Button
          variant="text"
          size="icon"
          icon={XIcon}
          aria-label="Limpar busca"
          title="Limpar busca"
          onClick={() => onChange("")}
          className="absolute top-1 right-1"
        />
      ) : null}
    </div>
  );
}
