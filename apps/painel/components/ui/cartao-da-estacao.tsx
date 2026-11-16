"use client";

import { ChevronDownIcon, ClipboardListIcon, StethoscopeIcon } from "lucide-react";
import { useState } from "react";
import { PainelLateral } from "@/components/formulario";
import { cn } from "@/lib/utils";

type EstacaoResumo = { id: string; nome: string; etapa: "triagem" | "atendimento" };

const ETAPAS = {
  triagem: { rotulo: "Triagem", Icone: ClipboardListIcon },
  atendimento: { rotulo: "Atendimento", Icone: StethoscopeIcon },
} as const;

/**
 * A estação em que a pessoa chama, como a unidade no menu: uma linha com o ícone da etapa e o nome;
 * com mais de uma, a troca num painel lateral com um cartão por estação.
 */
export function CartaoDaEstacao({
  estacoes,
  atual,
  aoEscolher,
}: {
  estacoes: EstacaoResumo[];
  atual: string | null;
  aoEscolher: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const escolhida = estacoes.find((e) => e.id === atual);
  if (!escolhida) return null;
  const varias = estacoes.length > 1;
  const { Icone } = ETAPAS[escolhida.etapa];
  const conteudo = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
        <Icone className="size-4" aria-hidden />
      </span>
      <span className="truncate text-sm font-extrabold text-slate-900">{escolhida.nome}</span>
      {varias ? <ChevronDownIcon className="size-4 shrink-0 text-slate-500" aria-hidden /> : null}
    </>
  );
  const classe =
    "flex max-w-72 items-center gap-2 rounded-xl border-2 border-b-[3px] border-[var(--ds-linha)] bg-white px-2 py-1.5";
  return (
    <>
      {varias ? (
        <button
          type="button"
          aria-label={`Estação: ${escolhida.nome}. Trocar de estação`}
          onClick={() => setAberto(true)}
          className={cn(
            classe,
            "transition-colors hover:border-slate-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
          )}
        >
          {conteudo}
        </button>
      ) : (
        <div className={classe}>{conteudo}</div>
      )}
      <PainelLateral aberto={aberto} aoFechar={() => setAberto(false)} titulo="Em qual estação você está?">
        <ul className="flex flex-col gap-3">
          {estacoes.map((e) => {
            const marcada = e.id === atual;
            const etapa = ETAPAS[e.etapa];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-current={marcada || undefined}
                  onClick={() => {
                    aoEscolher(e.id);
                    setAberto(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 p-4 text-left transition-colors",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
                    marcada
                      ? "border-[var(--ds-acao)] bg-primary-50"
                      : "border-[var(--ds-linha)] bg-white hover:border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      marcada ? "bg-[var(--ds-acao)] text-white" : "bg-primary-50 text-primary",
                    )}
                  >
                    <etapa.Icone className="size-5" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-extrabold text-slate-900">{e.nome}</span>
                    <span className="text-sm text-slate-600">{etapa.rotulo}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PainelLateral>
    </>
  );
}
