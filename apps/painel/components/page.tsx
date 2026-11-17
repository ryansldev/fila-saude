import { SettingsIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Topo de cada tela do painel: o nome da tela, uma linha dizendo para que ela serve e, à direita,
 * as ações principais (ex.: "Adicionar unidade").
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="max-w-2xl text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

const STATES: Record<string, { label: string; class: string }> = {
  planned: { label: "Planejada", class: "bg-slate-100 text-slate-600" },
  open: { label: "Aberta", class: "bg-emerald-100 text-emerald-800" },
  closed: { label: "Encerrada", class: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Cancelada", class: "bg-red-100 text-red-800" },
};

/** Estado da sessão como selo: verde só quando a fila está andando. */
export function SessionState({ state }: { state: string }) {
  const e = STATES[state] ?? { label: state, class: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${e.class}`}>
      {state === "open" ? <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" /> : null}
      {e.label}
    </span>
  );
}

/**
 * Ações de cada linha de tabela: lixeira em vermelho à esquerda e engrenagem na ponta direita.
 * `label` vira o nome acessível ("Editar UBS Centro") e a dica ao passar o mouse.
 */
export function RowActions({
  edit,
  exclude,
}: {
  edit?: { label: string; onClick: () => void };
  exclude?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex justify-end gap-1">
      {exclude ? (
        <Button
          variant="dangerText"
          size="icon"
          icon={Trash2Icon}
          aria-label={exclude.label}
          title={exclude.label}
          onClick={exclude.onClick}
        />
      ) : null}
      {edit ? (
        <Button
          variant="text"
          size="icon"
          icon={SettingsIcon}
          aria-label={edit.label}
          title={edit.label}
          onClick={edit.onClick}
        />
      ) : null}
    </div>
  );
}
