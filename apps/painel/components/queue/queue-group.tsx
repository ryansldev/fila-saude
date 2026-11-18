import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Um grupo da Fila do dia: ícone, título e contagem; vazio não aparece. */
export function QueueGroup({
  title,
  icon: Icon,
  total,
  tone = "neutral",
  collapsed = false,
  children,
}: {
  title: string;
  icon: LucideIcon;
  total: number;
  tone?: "neutral" | "alert" | "called";
  collapsed?: boolean;
  children: ReactNode;
}) {
  if (total === 0) return null;
  const head = (
    <span className="flex items-center gap-2 font-extrabold text-slate-900">
      <Icon
        className={cn(
          "size-4.5",
          tone === "alert" ? "text-amber-600" : tone === "called" ? "text-emerald-600" : "text-slate-500",
        )}
        aria-hidden
      />
      {title}
      <span className="rounded-full bg-slate-100 px-2 text-xs font-extrabold text-slate-600">{total}</span>
    </span>
  );
  const border = tone === "alert" ? "border-amber-300" : tone === "called" ? "border-emerald-300" : "border-slate-200";
  if (collapsed)
    return (
      <details className={`rounded-2xl border bg-white ${border}`}>
        <summary className="cursor-pointer list-none px-5 py-3">{head}</summary>
        <ul className="divide-y divide-slate-100 border-t border-slate-100 text-slate-500">{children}</ul>
      </details>
    );
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${border}`}>
      <header className="border-b border-slate-100 px-5 py-3">{head}</header>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}
