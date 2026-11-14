"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Texto } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { adicionarIntervalo, type ChaveDia, DIAS, type Horario } from "@/lib/formularios/horario";

/**
 * Horário de funcionamento: uma linha por dia, com os intervalos daquele dia; dia sem intervalo = fechado.
 * O título fica com quem usa (a seção do painel lateral).
 */
export function EditorDeHorario({
  valor,
  mudar,
  erros,
}: {
  valor: Horario;
  mudar: (h: Horario) => void;
  erros: Record<string, string>;
}) {
  const trocar = (dia: ChaveDia, i: number, campo: "abre" | "fecha", hora: string) =>
    mudar({ ...valor, [dia]: (valor[dia] ?? []).map((iv, j) => (j === i ? { ...iv, [campo]: hora } : iv)) });
  const remover = (dia: ChaveDia, i: number) => {
    const resto = (valor[dia] ?? []).filter((_, j) => j !== i);
    const novo = { ...valor };
    if (resto.length > 0) novo[dia] = resto;
    else delete novo[dia];
    mudar(novo);
  };

  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {DIAS.map(({ chave, nome }) => {
        const intervalos = valor[chave] ?? [];
        return (
          <div key={chave} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="w-24 shrink-0 pt-1.5 text-sm font-semibold text-slate-900">{nome}</span>
            <div className="flex flex-1 flex-col gap-2">
              {intervalos.length === 0 ? <span className="pt-1.5 text-sm text-slate-400">Fechado</span> : null}
              {intervalos.map((iv, i) => {
                const erro = erros[`horario.${chave}.${i}`];
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: intervalos editáveis sem id próprio
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Texto
                        type="time"
                        aria-label={`${nome}, início do intervalo ${i + 1}`}
                        aria-invalid={erro ? true : undefined}
                        className="w-28"
                        valor={iv.abre}
                        aoMudar={(hora) => trocar(chave, i, "abre", hora)}
                      />
                      <span className="text-sm text-slate-500">às</span>
                      <Texto
                        type="time"
                        aria-label={`${nome}, fim do intervalo ${i + 1}`}
                        aria-invalid={erro ? true : undefined}
                        className="w-28"
                        valor={iv.fecha}
                        aoMudar={(hora) => trocar(chave, i, "fecha", hora)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Remover intervalo ${i + 1} de ${nome}`}
                        title="Remover intervalo"
                        onClick={() => remover(chave, i)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                    {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              aria-label={`Adicionar intervalo em ${nome}`}
              onClick={() => mudar(adicionarIntervalo(valor, chave))}
            >
              <PlusIcon data-icon="inline-start" />
              Adicionar intervalo
            </Button>
          </div>
        );
      })}
    </div>
  );
}
