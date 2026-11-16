"use client";

import type { ResumoDeHoje } from "@fila-saude/schemas/unidade";
import { Building2Icon, ChevronDownIcon, IdCardIcon, MapPinIcon } from "lucide-react";
import { useState } from "react";
import { PainelLateral } from "@/components/formulario";
import { linhasDoEndereco, textoDoResumo, type UnidadeResumo, useUnidadeDoPainel } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";
import { cn } from "@/lib/utils";

const TIPOS: Record<string, string> = { ubs: "UBS", policlinica: "Policlínica", upa: "UPA" };

const dica = (u: UnidadeResumo) => [u.nome, ...(u.endereco ? linhasDoEndereco(u.endereco) : [])].join("\n");

/**
 * A unidade em que a pessoa está trabalhando, no topo do menu (para o painel inteiro): uma linha com o
 * nome, a bolinha verde se há sessão aberta e, com mais de uma unidade, a troca num painel lateral com
 * todas as informações para confirmar que é aquela mesma.
 */
export function UnidadeNoMenu() {
  const { todas, atual, escolher, erro, carregou, unidade } = useUnidadeDoPainel();
  const hoje = useConsulta<ResumoDeHoje[]>(todas.length > 0 ? "/v1/painel/unidades/hoje" : null, 60_000);
  const [aberto, setAberto] = useState(false);
  if (!carregou) return null;
  if (erro || todas.length === 0)
    return (
      <p className="mx-3 mb-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">{erro ?? "Nenhuma unidade"}</p>
    );
  const resumoDe = (id: string) => hoje.dado?.find((h) => h.unidadeId === id);
  const aberta = (resumoDe(atual ?? "")?.abertas ?? 0) > 0;
  const varias = todas.length > 1;
  const conteudo = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
        <Building2Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm font-extrabold text-slate-900">
        {unidade?.nome ?? "Escolha a unidade"}
      </span>
      {aberta ? (
        <span className="size-2 shrink-0 rounded-full bg-green-600" role="img" aria-label="sessão aberta" />
      ) : null}
      {varias ? <ChevronDownIcon className="size-4 shrink-0 text-slate-500" aria-hidden /> : null}
    </>
  );
  const classe =
    "mx-3 mb-3 flex items-center gap-2 rounded-xl border-2 border-b-[3px] border-[var(--ds-linha)] bg-white px-2 py-1.5";
  return (
    <>
      {varias ? (
        <button
          type="button"
          title={unidade ? dica(unidade) : undefined}
          aria-label={`Unidade: ${unidade?.nome ?? "nenhuma"}. Trocar de unidade`}
          onClick={() => setAberto(true)}
          className={cn(
            classe,
            "transition-colors hover:border-slate-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
          )}
        >
          {conteudo}
        </button>
      ) : (
        <div className={classe} title={unidade ? dica(unidade) : undefined}>
          {conteudo}
        </div>
      )}
      <PainelLateral aberto={aberto} aoFechar={() => setAberto(false)} titulo="Em qual unidade você está?">
        <ul className="flex flex-col gap-3">
          {todas.map((u) => {
            const escolhida = u.id === atual;
            const resumo = textoDoResumo(resumoDe(u.id), u.fuso);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  aria-current={escolhida || undefined}
                  onClick={() => {
                    escolher(u.id);
                    setAberto(false);
                  }}
                  className={cn(
                    "grid w-full grid-cols-[40px_1fr_auto] items-start gap-3 rounded-2xl border-2 border-b-4 p-4 text-left transition-colors",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-acao)]",
                    escolhida
                      ? "border-[var(--ds-acao)] bg-primary-50"
                      : "border-[var(--ds-linha)] bg-white hover:border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      escolhida ? "bg-[var(--ds-acao)] text-white" : "bg-primary-50 text-primary",
                    )}
                  >
                    <Building2Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-extrabold text-slate-900">{u.nome}</span>
                    {u.endereco ? (
                      <span className="flex gap-1.5 text-sm text-slate-600">
                        <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="flex flex-col">
                          {linhasDoEndereco(u.endereco).map((l) => (
                            <span key={l}>{l}</span>
                          ))}
                        </span>
                      </span>
                    ) : null}
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                      {u.tipo ? <span className="rounded-md bg-slate-100 px-2 py-0.5">{TIPOS[u.tipo]}</span> : null}
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
                        <IdCardIcon className="size-3.5" aria-hidden />
                        {u.cnes ? `CNES ${u.cnes}` : "sem CNES"}
                      </span>
                    </span>
                  </span>
                  {resumo ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap",
                        (resumoDe(u.id)?.abertas ?? 0) > 0
                          ? "bg-green-100 text-green-900"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {resumo}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PainelLateral>
    </>
  );
}
