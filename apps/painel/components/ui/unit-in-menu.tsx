"use client";

import type { TodaySummary, UnitKind } from "@fila-saude/schemas/unit";
import { Building2Icon, ChevronDownIcon, IdCardIcon, MapPinIcon } from "lucide-react";
import { useState } from "react";
import { SidePanel } from "@/components/form";
import { addressRows, summaryText, type UnitSummary, usePanelUnit } from "@/lib/current-unit";
import { useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";

const KINDS: Record<UnitKind, string> = { ubs: "UBS", polyclinic: "Policlínica", upa: "UPA" };

const hint = (u: UnitSummary) => [u.name, ...(u.address ? addressRows(u.address) : [])].join("\n");

/**
 * A unidade em que a pessoa está trabalhando, no topo do menu (para o painel inteiro): uma linha com o
 * nome, a bolinha verde se há sessão aberta e, com mais de uma unidade, a troca num painel lateral com
 * todas as informações para confirmar que é aquela mesma.
 */
export function UnitInMenu() {
  const { all, current, choose, error, loaded, unit } = usePanelUnit();
  const today = useQuery<TodaySummary[]>(all.length > 0 ? "/v1/panel/units/today" : null, 60_000);
  const [open, setOpen] = useState(false);
  if (!loaded) return null;
  if (error || all.length === 0)
    return (
      <p className="mx-3 mb-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">{error ?? "Nenhuma unidade"}</p>
    );
  const summaryOf = (id: string) => today.detail?.find((h) => h.unitId === id);
  const hasOpenSession = (summaryOf(current ?? "")?.open ?? 0) > 0;
  const several = all.length > 1;
  const content = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
        <Building2Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm font-extrabold text-slate-900">
        {unit?.name ?? "Escolha a unidade"}
      </span>
      {hasOpenSession ? (
        <span className="size-2 shrink-0 rounded-full bg-green-600" role="img" aria-label="sessão aberta" />
      ) : null}
      {several ? <ChevronDownIcon className="size-4 shrink-0 text-slate-500" aria-hidden /> : null}
    </>
  );
  const cssClass =
    "mx-3 mb-3 flex items-center gap-2 rounded-xl border-2 border-b-[3px] border-[var(--ds-line)] bg-white px-2 py-1.5";
  return (
    <>
      {several ? (
        <button
          type="button"
          title={unit ? hint(unit) : undefined}
          aria-label={`Unidade: ${unit?.name ?? "nenhuma"}. Trocar de unidade`}
          onClick={() => setOpen(true)}
          className={cn(
            cssClass,
            "transition-colors hover:border-slate-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-action)]",
          )}
        >
          {content}
        </button>
      ) : (
        <div className={cssClass} title={unit ? hint(unit) : undefined}>
          {content}
        </div>
      )}
      <SidePanel open={open} onClose={() => setOpen(false)} title="Em qual unidade você está?">
        <ul className="flex flex-col gap-3">
          {all.map((u) => {
            const chosen = u.id === current;
            const summary = summaryText(summaryOf(u.id), u.timeZone);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  aria-current={chosen || undefined}
                  onClick={() => {
                    choose(u.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid w-full grid-cols-[40px_1fr_auto] items-start gap-3 rounded-2xl border-2 border-b-4 p-4 text-left transition-colors",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-action)]",
                    chosen
                      ? "border-[var(--ds-action)] bg-primary-50"
                      : "border-[var(--ds-line)] bg-white hover:border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      chosen ? "bg-[var(--ds-action)] text-white" : "bg-primary-50 text-primary",
                    )}
                  >
                    <Building2Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-extrabold text-slate-900">{u.name}</span>
                    {u.address ? (
                      <span className="flex gap-1.5 text-sm text-slate-600">
                        <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="flex flex-col">
                          {addressRows(u.address).map((l) => (
                            <span key={l}>{l}</span>
                          ))}
                        </span>
                      </span>
                    ) : null}
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                      {u.kind ? <span className="rounded-md bg-slate-100 px-2 py-0.5">{KINDS[u.kind]}</span> : null}
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
                        <IdCardIcon className="size-3.5" aria-hidden />
                        {u.cnes ? `CNES ${u.cnes}` : "sem CNES"}
                      </span>
                    </span>
                  </span>
                  {summary ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap",
                        (summaryOf(u.id)?.open ?? 0) > 0
                          ? "bg-green-100 text-green-900"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {summary}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </SidePanel>
    </>
  );
}
