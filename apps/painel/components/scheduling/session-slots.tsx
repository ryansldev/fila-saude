import type { SessionAllocation } from "@fila-saude/schemas/queue";
import { allocatedSituation, allocateUntil, slotText, whenInTimeZone } from "@/lib/scheduling";
import { AnswerButtons } from "./answer-buttons";
import { Badge } from "./badge";
import type { Answer } from "./kinds";
import { SlotBars } from "./slot-bars";

/** As vagas da sessão escolhida: quantas, até quando alocar e quem já está nelas. */
export function SessionSlots({
  d,
  timeZone,
  sending,
  answer,
}: {
  d: SessionAllocation;
  timeZone: string;
  sending: boolean;
  answer: (entryId: string, name: string, r: Answer) => void;
}) {
  const confirmed = d.allocated.filter((a) => a.state !== "allocated").length;
  const pending = d.allocated.length - confirmed;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-extrabold text-slate-900">
            {d.session.slots === null
              ? slotText(d.session.taken, null)
              : `Vagas ocupadas · ${d.session.taken} de ${d.session.slots}`}
          </h2>
          <span className="text-sm text-slate-500">
            {d.session.canAllocate ? `alocação até ${allocateUntil(d.session.start, timeZone)}` : d.session.reason}
          </span>
        </div>
        <SlotBars slots={d.session.slots} taken={d.session.taken} confirmed={confirmed} pending={pending} />
      </header>
      {d.allocated.length === 0 ? (
        <p className="px-5 py-4 text-slate-600">Ninguém alocado ainda. Comece pela sugestão abaixo.</p>
      ) : (
        <ul>
          {d.allocated.map((a) => {
            const s = allocatedSituation(a);
            return (
              <li
                key={a.entryId}
                className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900">{a.name}</span>
                  <span className="text-slate-500"> · {a.age} anos</span>
                  {a.deadline ? (
                    <div className="text-sm text-slate-500">confirmar até {whenInTimeZone(a.deadline, timeZone)}</div>
                  ) : null}
                </div>
                <Badge text={s.label} tone={s.tone} />
                {a.state === "allocated" ? (
                  <AnswerButtons sending={sending} onAnswer={(r) => answer(a.entryId, a.name, r)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
