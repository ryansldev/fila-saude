import type { SessionAllocation } from "@fila-saude/schemas/queue";
import { Button } from "@/components/ui/button";
import { reasonRow, riskBadge } from "@/lib/scheduling";
import { Badge } from "./badge";

/**
 * RN-AL-01/02: quem o sistema sugere para as vagas, na ordem, com os motivos. Só o primeiro leva o
 * botão principal (uma ação principal por área); nada é alocado sozinho (INV-08).
 */
export function Suggestion({
  d,
  sending,
  allocate,
}: {
  d: SessionAllocation;
  sending: boolean;
  allocate: (entryId: string, name: string) => void;
}) {
  const free = d.session.slots === null ? null : Math.max(0, d.session.slots - d.session.taken);
  const title =
    free === null
      ? "Sugestão"
      : free === 0
        ? "Sugestão (sem vagas livres)"
        : `Sugestão para ${free === 1 ? "a vaga livre" : `as ${free} vagas livres`}`;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
      </header>
      {d.suggestion.length === 0 ? (
        <p className="px-5 py-4 text-slate-600">Ninguém na lista para esta sessão.</p>
      ) : (
        <ul>
          {d.suggestion.map((x, i) => {
            const risk = riskBadge(x.risk);
            return (
              <li
                key={x.entryId}
                className={`flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 ${x.alert ? "bg-amber-50" : ""}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{x.name}</span>
                    <span className="text-slate-500">· {x.age} anos</span>
                    {x.withoutApp ? <span className="text-slate-500">· sem app</span> : null}
                    {risk ? <Badge text={risk.label} tone={risk.tone} /> : null}
                    {x.self_harm ? <Badge text="Risco de autolesão · CVV 188 · SAMU 192" tone="danger" /> : null}
                    {x.noShowAlert ? <Badge text={`${x.noShows} faltas recentes`} tone="neutral" /> : null}
                  </div>
                  <span className="text-sm text-slate-600" title={x.risk.rule}>
                    {reasonRow(x.risk, x.reasons)}
                  </span>
                </div>
                <Button
                  size="compact"
                  variant={i === 0 ? "primary" : "secondary"}
                  disabled={sending || !d.session.canAllocate}
                  onClick={() => allocate(x.entryId, x.name)}
                >
                  Alocar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
