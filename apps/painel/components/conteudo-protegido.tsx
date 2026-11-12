"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { menuDoPainel, type PerfilDoUsuario, podeAcessar } from "@/lib/navegacao";

/** Só mostra a página para quem pode acessá-la; os outros veem o aviso e o caminho para o que podem usar. */
export function ConteudoProtegido({
  caminho,
  perfis,
  children,
}: {
  caminho: string;
  perfis: PerfilDoUsuario[];
  children: ReactNode;
}) {
  if (podeAcessar(caminho, perfis)) return children;
  const destino = menuDoPainel(perfis)[0];
  return (
    <div className="flex max-w-lg flex-col gap-3">
      <h1 className="text-2xl font-bold text-gray-900">Sem acesso</h1>
      <p className="text-gray-700">Esta página não faz parte das suas permissões no painel.</p>
      {destino ? (
        <Link
          href={destino.href}
          className="self-start rounded-lg px-3 py-2 font-medium text-primary hover:bg-gray-100"
        >
          Ir para {destino.rotulo}
        </Link>
      ) : null}
    </div>
  );
}
