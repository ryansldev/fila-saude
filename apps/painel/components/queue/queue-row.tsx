import type { TodayItem } from "@fila-saude/schemas/queue";
import { ClockIcon, IdCardIcon, StethoscopeIcon, UsersRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { documentText, guardianText, rowContext } from "@/lib/queue";
import { cn } from "@/lib/utils";

const TONE_COLOR = { neutral: "text-slate-600", alert: "text-amber-800", called: "text-emerald-700" } as const;

/**
 * Uma pessoa na Fila do dia: senha, nome e selos em cima; embaixo, cada informação no seu lugar
 * (serviço, situação, tempo, documento), sem "Info · Info · Info". Ações à direita.
 */
export function QueueRow({
  i,
  now,
  document,
  actions,
}: {
  i: TodayItem;
  now: number;
  /** A recepção vê nascimento e CPF mascarado para comparar com o documento. */
  document: boolean;
  actions?: ReactNode;
}) {
  const c = rowContext(i, now);
  const guardian = guardianText(i.guardian);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <span className="w-20 shrink-0 rounded-lg bg-slate-100 py-1 text-center font-mono text-lg font-extrabold text-slate-800">
        {i.ticket}
      </span>
      <div className="flex min-w-56 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
          {i.name}
          {i.priority ? (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-600">
              prioridade
            </span>
          ) : null}
          {i.skips > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              {i.skips === 1 ? "1 pulo" : `${i.skips} pulos`}
            </span>
          ) : null}
          {guardian ? (
            <span
              title={guardian.label}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700"
            >
              <UsersRoundIcon className="size-3.5" aria-hidden />
              <span className="sr-only">inscrição feita </span>
              {guardian.text}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
            <StethoscopeIcon className="size-3.5" aria-hidden />
            {i.service}
          </span>
          <span className={cn("font-semibold", TONE_COLOR[c.tone])}>{c.text}</span>
          {c.time ? (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <ClockIcon className="size-3.5" aria-hidden />
              {c.time}
            </span>
          ) : null}
          {document && i.document
            ? documentText(i.document).map((part, n) => (
                <span key={part} className="inline-flex items-center gap-1 text-slate-500">
                  {n === 0 ? <IdCardIcon className="size-3.5" aria-hidden /> : null}
                  {part}
                </span>
              ))
            : null}
        </span>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}
