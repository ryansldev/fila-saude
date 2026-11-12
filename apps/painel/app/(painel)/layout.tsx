"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { ConteudoProtegido } from "@/components/conteudo-protegido";
import { Logo } from "@/components/logo";
import { useApi } from "@/lib/api-context";
import { menuDoPainel } from "@/lib/navegacao";
import { sair, useEu } from "@/lib/sessao";

export default function LayoutDoPainel({ children }: { children: ReactNode }) {
  const router = useRouter();
  const api = useApi();
  const caminho = usePathname();
  const eu = useEu();

  useEffect(() => {
    if (eu.estado === "anonimo") router.replace("/login");
  }, [eu.estado, router]);

  if (eu.estado === "erro") return <p className="p-8 text-gray-700">Não foi possível carregar. Tente de novo.</p>;
  if (eu.estado !== "autenticado") return <p className="p-8 text-gray-500">Carregando...</p>;

  const menu = menuDoPainel(eu.eu.perfis);
  return (
    <div className="flex flex-1">
      <nav aria-label="Menu do painel" className="flex w-60 flex-col gap-1 border-r border-gray-200 p-4">
        <Logo className="mb-4 size-10 text-primary" />
        <p className="mb-2 text-sm text-gray-600">{eu.eu.nome}</p>
        {menu.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-gray-800 hover:bg-gray-100">
            {item.rotulo}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => void sair(api, (href) => router.replace(href))}
          className="mt-auto rounded-lg px-3 py-2 text-left text-gray-600 hover:bg-gray-100"
        >
          Sair
        </button>
      </nav>
      <main className="flex-1 p-8">
        <ConteudoProtegido caminho={caminho} perfis={eu.eu.perfis}>
          {children}
        </ConteudoProtegido>
      </main>
    </div>
  );
}
