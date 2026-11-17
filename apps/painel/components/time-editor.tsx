"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Text } from "@/components/form";
import { Button } from "@/components/ui/button";
import { addInterval, DAYS, type DayKey, type Time } from "@/lib/forms/time";

/**
 * Horário de funcionamento: uma linha por dia, com os intervalos daquele dia; dia sem intervalo = fechado.
 * O título fica com quem usa (a seção do painel lateral).
 */
export function TimeEditor({
  value,
  change,
  errors,
}: {
  value: Time;
  change: (h: Time) => void;
  errors: Record<string, string>;
}) {
  const swap = (day: DayKey, i: number, field: "opens" | "closes", hour: string) =>
    change({ ...value, [day]: (value[day] ?? []).map((iv, j) => (j === i ? { ...iv, [field]: hour } : iv)) });
  const remove = (day: DayKey, i: number) => {
    const rest = (value[day] ?? []).filter((_, j) => j !== i);
    const fresh = { ...value };
    if (rest.length > 0) fresh[day] = rest;
    else delete fresh[day];
    change(fresh);
  };

  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {DAYS.map(({ key, name }) => {
        const intervals = value[key] ?? [];
        return (
          <div key={key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="w-24 shrink-0 pt-1.5 text-sm font-semibold text-slate-900">{name}</span>
            <div className="flex flex-1 flex-col gap-2">
              {intervals.length === 0 ? <span className="pt-1.5 text-sm text-slate-400">Fechado</span> : null}
              {intervals.map((iv, i) => {
                const error = errors[`horario.${key}.${i}`];
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: intervalos editáveis sem id próprio
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Text
                        type="time"
                        aria-label={`${name}, início do intervalo ${i + 1}`}
                        aria-invalid={error ? true : undefined}
                        className="w-28"
                        value={iv.opens}
                        onChange={(hour) => swap(key, i, "opens", hour)}
                      />
                      <span className="text-sm text-slate-500">às</span>
                      <Text
                        type="time"
                        aria-label={`${name}, fim do intervalo ${i + 1}`}
                        aria-invalid={error ? true : undefined}
                        className="w-28"
                        value={iv.closes}
                        onChange={(hour) => swap(key, i, "closes", hour)}
                      />
                      <Button
                        type="button"
                        variant="text"
                        size="icon"
                        aria-label={`Remover intervalo ${i + 1} de ${name}`}
                        title="Remover intervalo"
                        onClick={() => remove(key, i)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                    {error ? <span className="text-xs text-destructive">{error}</span> : null}
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="self-start"
              aria-label={`Adicionar intervalo em ${name}`}
              onClick={() => change(addInterval(value, key))}
            >
              <PlusIcon data-icon="inline-start" />
              Adicionar intervalo
            </Button>
          </div>
        );
      })}
    </div>
  );
}
