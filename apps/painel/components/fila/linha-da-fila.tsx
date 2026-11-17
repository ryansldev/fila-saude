import type { ItemDeHoje } from "@fila-saude/schemas/fila";
import { ClockIcon, IdCardIcon, StethoscopeIcon, UsersRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { contextoDaLinha, textoDoDocumento, textoDoResponsavel } from "@/lib/fila";
import { cn } from "@/lib/utils";

const COR_DO_TOM = { neutro: "text-slate-600", alerta: "text-amber-800", chamado: "text-emerald-700" } as const;

/**
 * Uma pessoa na Fila do dia: senha, nome e selos em cima; embaixo, cada informação no seu lugar
 * (serviço, situação, tempo, documento), sem "Info · Info · Info". Ações à direita.
 */
export function LinhaDaFila({
  i,
  agora,
  documento,
  acoes,
}: {
  i: ItemDeHoje;
  agora: number;
  /** A recepção vê nascimento e CPF mascarado para comparar com o documento. */
  documento: boolean;
  acoes?: ReactNode;
}) {
  const c = contextoDaLinha(i, agora);
  const responsavel = textoDoResponsavel(i.responsavel);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <span className="w-20 shrink-0 rounded-lg bg-slate-100 py-1 text-center font-mono text-lg font-extrabold text-slate-800">
        {i.senha}
      </span>
      <div className="flex min-w-56 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
          {i.nome}
          {i.prioridade ? (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-600">
              prioridade
            </span>
          ) : null}
          {i.pulos > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              {i.pulos === 1 ? "1 pulo" : `${i.pulos} pulos`}
            </span>
          ) : null}
          {responsavel ? (
            <span
              title={responsavel.rotulo}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700"
            >
              <UsersRoundIcon className="size-3.5" aria-hidden />
              <span className="sr-only">inscrição feita </span>
              {responsavel.texto}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
            <StethoscopeIcon className="size-3.5" aria-hidden />
            {i.servico}
          </span>
          <span className={cn("font-semibold", COR_DO_TOM[c.tom])}>{c.texto}</span>
          {c.tempo ? (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <ClockIcon className="size-3.5" aria-hidden />
              {c.tempo}
            </span>
          ) : null}
          {documento ? (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <IdCardIcon className="size-3.5" aria-hidden />
              {textoDoDocumento(i.documento)}
            </span>
          ) : null}
        </span>
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </li>
  );
}
