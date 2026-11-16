"use client";

import type { ItemDeLigacao } from "@fila-saude/schemas/fila";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

/** Quantas pessoas falta ligar na unidade escolhida (a cada 60 s); some com zero. */
export function ContadorDoMenu({ ativo }: { ativo: boolean }) {
  const { atual } = useUnidadeAtual(["alocar_confirmar_recusar_pelo_paciente"]);
  const ligacao = useConsulta<ItemDeLigacao[]>(atual ? `/v1/painel/unidades/${atual}/ligacao` : null, 60_000);
  const total = ligacao.dado?.length ?? 0;
  if (total === 0) return null;
  return (
    <span
      className={`ml-auto rounded-full px-2 text-xs font-extrabold ${ativo ? "bg-white text-primary" : "bg-amber-400 text-slate-950"}`}
      title={total === 1 ? "1 pessoa para ligar" : `${total} pessoas para ligar`}
    >
      {total}
    </span>
  );
}
