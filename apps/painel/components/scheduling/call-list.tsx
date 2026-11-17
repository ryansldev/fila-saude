import type { CallListItem } from "@fila-saude/schemas/queue";
import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whenInTimeZone } from "@/lib/scheduling";
import { Badge } from "./badge";
import type { Answer } from "./kinds";

/** RN-CONF-03: quem foi alocado e não respondeu, pela sessão mais próxima; destacado depois do prazo. */
export function CallList({
  items,
  timeZone,
  sending,
  answer,
}: {
  items: CallListItem[];
  timeZone: string;
  sending: boolean;
  answer: (entryId: string, name: string, r: Answer) => void;
}) {
  if (items.length === 0)
    return <p className="text-slate-600">Ninguém esperando resposta. Toda alocação pendente aparece aqui.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li
          key={i.entryId}
          className={`flex flex-col gap-3 rounded-xl border p-4 ${i.highlighted ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-900">{i.name}</span>
              <span className="text-sm text-slate-600">
                {i.service} · {whenInTimeZone(i.session.start, timeZone)}
              </span>
            </div>
            {i.highlighted ? <Badge text="Sem resposta: ligar" tone="alert" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
              <PhoneIcon className="size-4" aria-hidden />
              {i.phone ?? "sem app: procurar na recepção"}
            </span>
            <span className="text-slate-600">confirmar até {whenInTimeZone(i.deadline, timeZone)}</span>
            {i.lastAttempt ? (
              <span className="text-slate-600">última tentativa {whenInTimeZone(i.lastAttempt, timeZone)}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="compact"
              variant="success"
              disabled={sending}
              onClick={() => answer(i.entryId, i.name, "confirmed")}
            >
              Confirmou
            </Button>
            <Button
              size="compact"
              variant="secondary"
              disabled={sending}
              onClick={() => answer(i.entryId, i.name, "no_contact")}
            >
              Sem contato
            </Button>
            <Button
              size="compact"
              variant="outlineDanger"
              disabled={sending}
              onClick={() => answer(i.entryId, i.name, "refused")}
            >
              Recusou
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
