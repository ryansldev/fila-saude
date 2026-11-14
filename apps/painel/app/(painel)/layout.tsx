"use client";

import {
  Building2Icon,
  CalendarDaysIcon,
  CircleIcon,
  ClockIcon,
  DoorOpenIcon,
  LogOutIcon,
  type LucideIcon,
  MegaphoneIcon,
  QrCodeIcon,
  StethoscopeIcon,
  TvIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { ConteudoProtegido } from "@/components/conteudo-protegido";
import { ProvedorDeDialogos } from "@/components/dialogos";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type GrupoDoMenu, menuDoPainel } from "@/lib/navegacao";
import { sair, useEu } from "@/lib/sessao";

const GRUPOS: { id: GrupoDoMenu; titulo: string }[] = [
  { id: "atendimento", titulo: "Atendimento" },
  { id: "configuracao", titulo: "Configuração" },
];

const ICONES: Record<string, LucideIcon> = {
  "/fila": UsersRoundIcon,
  "/estacao": MegaphoneIcon,
  "/qr": QrCodeIcon,
  "/unidades": Building2Icon,
  "/equipe": UsersIcon,
  "/servicos": StethoscopeIcon,
  "/estacoes": DoorOpenIcon,
  "/sessoes": CalendarDaysIcon,
  "/tvs": TvIcon,
  "/em-breve": ClockIcon,
};

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
  const grupos = GRUPOS.map((g) => ({ ...g, itens: menu.filter((i) => i.grupo === g.id) })).filter(
    (g) => g.itens.length > 0,
  );
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);
  const iniciais = eu.eu.nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex min-h-screen flex-1 bg-slate-100/70">
      <nav
        aria-label="Menu do painel"
        className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white"
      >
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <Logo className="size-9 text-primary" />
          <span className="text-lg font-extrabold tracking-tight text-slate-900">fila saúde</span>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
          {grupos.map((g) => (
            <div key={g.id} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-semibold text-slate-400">{g.titulo}</p>
              {g.itens.map((item) => {
                const Icone = ICONES[item.href] ?? CircleIcon;
                const atual = ativo(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={atual ? "page" : undefined}
                    className={
                      atual
                        ? "flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 font-bold text-white shadow-[0_3px_0_0_var(--color-primary-700)]"
                        : "flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    }
                  >
                    <Icone className="size-5 shrink-0" strokeWidth={atual ? 2.4 : 2} />
                    {item.rotulo}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="m-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-extrabold text-primary-600">
            {iniciais}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{eu.eu.nome}</p>
            <p className="truncate text-xs text-slate-500">{eu.eu.login}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sair"
            title="Sair"
            className="text-slate-500 hover:text-slate-900"
            onClick={() => void sair(api, (href) => router.replace(href))}
          >
            <LogOutIcon />
          </Button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 px-10 py-8">
        <ProvedorDeDialogos>
          <ConteudoProtegido caminho={caminho} perfis={eu.eu.perfis}>
            {children}
          </ConteudoProtegido>
        </ProvedorDeDialogos>
      </main>
    </div>
  );
}
