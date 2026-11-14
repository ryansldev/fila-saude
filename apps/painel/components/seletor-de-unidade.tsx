"use client";

import { classeDoCampo } from "@/components/formulario";
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
    <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-gray-700">
      Unidade
      <select className={classeDoCampo} value={atual ?? ""} onChange={(e) => escolher(e.target.value)}>
        <option value="" disabled>
          Escolha a unidade
        </option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
