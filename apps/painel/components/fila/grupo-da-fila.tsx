import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Um grupo da Fila do dia: ícone, título e contagem; vazio não aparece. */
export function GrupoDaFila({
  titulo,
  icone: Icone,
  total,
  tom = "neutro",
  recolhido = false,
  children,
}: {
  titulo: string;
  icone: LucideIcon;
  total: number;
  tom?: "neutro" | "alerta" | "chamado";
  recolhido?: boolean;
  children: ReactNode;
}) {
  if (total === 0) return null;
  const cabeca = (
    <span className="flex items-center gap-2 font-extrabold text-slate-900">
      <Icone
        className={cn(
          "size-4.5",
          tom === "alerta" ? "text-amber-600" : tom === "chamado" ? "text-emerald-600" : "text-slate-500",
        )}
        aria-hidden
      />
      {titulo}
      <span className="rounded-full bg-slate-100 px-2 text-xs font-extrabold text-slate-600">{total}</span>
    </span>
  );
  const borda = tom === "alerta" ? "border-amber-300" : tom === "chamado" ? "border-emerald-300" : "border-slate-200";
  if (recolhido)
    return (
      <details className={`rounded-2xl border bg-white ${borda}`}>
        <summary className="cursor-pointer list-none px-5 py-3">{cabeca}</summary>
        <ul className="divide-y divide-slate-100 border-t border-slate-100 text-slate-500">{children}</ul>
      </details>
    );
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${borda}`}>
      <header className="border-b border-slate-100 px-5 py-3">{cabeca}</header>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}
