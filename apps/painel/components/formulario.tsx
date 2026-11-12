"use client";

import type { ReactNode } from "react";

export const classeDoCampo =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-primary aria-invalid:border-red-600";

export function Campo({
  rotulo,
  erro,
  dica,
  children,
}: {
  rotulo: string;
  erro?: string | undefined;
  dica?: string | undefined;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: o controle vem em `children`.
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {rotulo}
      {children}
      {dica ? <span className="text-xs font-normal text-gray-500">{dica}</span> : null}
      {erro ? <span className="text-xs font-normal text-red-700">{erro}</span> : null}
    </label>
  );
}

export function Aviso({ texto, tipo = "erro" }: { texto: string | null; tipo?: "erro" | "ok" }) {
  if (!texto) return null;
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={tipo === "erro" ? "text-sm text-red-700" : "text-sm text-green-700"}
    >
      {texto}
    </p>
  );
}

export function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      {children}
    </section>
  );
}

export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-gray-500">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="py-2 pr-4 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-800">{children}</tbody>
      </table>
    </div>
  );
}
