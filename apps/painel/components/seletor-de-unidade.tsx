"use client";

import { Campo, Selecao } from "@/components/formulario";
import type { UnidadeResumo } from "@/lib/unidade-atual";

export function SeletorDeUnidade({
  unidades,
  atual,
  escolher,
  erro = null,
}: {
  unidades: UnidadeResumo[];
  atual: string | null;
  escolher: (id: string) => void;
  erro?: string | null;
}) {
  if (erro) return <p className="text-sm text-red-700">{erro}</p>;
  if (unidades.length === 0) return <p className="text-gray-600">Nenhuma unidade disponível.</p>;
  return (
    <div className="w-full sm:w-72">
      <Campo rotulo="Unidade">
        <Selecao
          valor={atual ?? ""}
          aoMudar={(id) => id && escolher(id)}
          placeholder="Escolha a unidade"
          opcoes={unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
        />
      </Campo>
    </div>
  );
}
