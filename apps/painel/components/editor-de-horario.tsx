"use client";

import { Texto } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { adicionarIntervalo, type ChaveDia, DIAS, type Horario } from "@/lib/formularios/horario";

/** Horário de funcionamento: uma lista de intervalos por dia; dia sem intervalo = fechado. */
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
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-gray-800">Horário de funcionamento</legend>
      {DIAS.map(({ chave, nome }) => {
        const intervalos = valor[chave] ?? [];
        return (
          <div key={chave} className="flex flex-wrap items-start gap-3 border-b border-gray-100 py-2">
            <span className="w-20 pt-2 text-sm font-medium text-gray-700">{nome}</span>
            <div className="flex flex-1 flex-col gap-2">
              {intervalos.length === 0 ? <span className="pt-2 text-sm text-gray-500">Fechado</span> : null}
              {intervalos.map((iv, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: intervalos editáveis sem id próprio
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Texto
                      type="time"
                      aria-label={`${nome}, início do intervalo ${i + 1}`}
                      aria-invalid={erros[`horario.${chave}.${i}`] ? true : undefined}
                      className="w-32"
                      valor={iv.abre}
                      aoMudar={(hora) => trocar(chave, i, "abre", hora)}
                    />
                    <span className="text-gray-500">às</span>
                    <Texto
                      type="time"
                      aria-label={`${nome}, fim do intervalo ${i + 1}`}
                      aria-invalid={erros[`horario.${chave}.${i}`] ? true : undefined}
                      className="w-32"
                      valor={iv.fecha}
                      aoMudar={(hora) => trocar(chave, i, "fecha", hora)}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => remover(chave, i)}>
                      Remover
                    </Button>
                  </div>
                  {erros[`horario.${chave}.${i}`] ? (
                    <span className="text-xs text-red-700">{erros[`horario.${chave}.${i}`]}</span>
                  ) : null}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => mudar(adicionarIntervalo(valor, chave))}>
              + Intervalo
            </Button>
          </div>
        );
      })}
    </fieldset>
  );
}
