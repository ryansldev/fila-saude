import type { ReactNode } from "react";

/**
 * Topo de cada tela do painel: o nome da tela, uma linha dizendo para que ela serve e, à direita,
 * as ações principais (ex.: "Adicionar unidade").
 */
export function CabecalhoDaPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{titulo}</h1>
        {descricao ? <p className="max-w-2xl text-slate-500">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  );
}

const ESTADOS: Record<string, { rotulo: string; classe: string }> = {
  planejada: { rotulo: "Planejada", classe: "bg-slate-100 text-slate-600" },
  aberta: { rotulo: "Aberta", classe: "bg-emerald-100 text-emerald-800" },
  encerrada: { rotulo: "Encerrada", classe: "bg-slate-200 text-slate-700" },
  cancelada: { rotulo: "Cancelada", classe: "bg-red-100 text-red-800" },
};

/** Estado da sessão como selo: verde só quando a fila está andando. */
export function EstadoDaSessao({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { rotulo: estado, classe: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${e.classe}`}>
      {estado === "aberta" ? <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" /> : null}
      {e.rotulo}
    </span>
  );
}
