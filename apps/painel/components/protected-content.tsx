"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { canAccess, panelMenu, type UserProfile } from "@/lib/navigation";

/** Só mostra a página para quem pode acessá-la; os outros veem o aviso e o caminho para o que podem usar. */
export function ProtectedContent({
  path,
  profiles,
  children,
}: {
  path: string;
  profiles: UserProfile[];
  children: ReactNode;
}) {
  if (canAccess(path, profiles)) return children;
  const destination = panelMenu(profiles)[0];
  return (
    <div className="flex max-w-lg flex-col gap-3">
      <h1 className="text-2xl font-bold text-gray-900">Sem acesso</h1>
      <p className="text-gray-700">Esta página não faz parte das suas permissões no painel.</p>
      {destination ? (
        <Link
          href={destination.href}
          className="self-start rounded-lg px-3 py-2 font-medium text-primary hover:bg-gray-100"
        >
          Ir para {destination.label}
        </Link>
      ) : null}
    </div>
  );
}
