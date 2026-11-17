"use client";

import { CircleIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { DialogsProvider } from "@/components/dialogs";
import { Logo } from "@/components/logo";
import { ProtectedContent } from "@/components/protected-content";
import { MenuCounter } from "@/components/scheduling/menu-counter";
import { Button } from "@/components/ui/button";
import { UnitInMenu } from "@/components/ui/unit-in-menu";
import { useApi } from "@/lib/api-context";
import { UnitProvider, usePanelUnit } from "@/lib/current-unit";
import { MENU_ICONS, type MenuGroup, panelMenu, profilesInUnit } from "@/lib/navigation";
import { leave, useMe } from "@/lib/session";

const GROUPS: { id: MenuGroup; title: string }[] = [
  { id: "care", title: "Atendimento" },
  { id: "configuration", title: "Configuração" },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <UnitProvider>
      <Frame>{children}</Frame>
    </UnitProvider>
  );
}

/** Menu e conteúdo pela unidade escolhida no topo do menu (o que a pessoa pode fazer nela). */
function Frame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const api = useApi();
  const path = usePathname();
  const me = useMe();
  const { current: unitId } = usePanelUnit();

  useEffect(() => {
    if (me.state === "anonymous") router.replace("/login");
  }, [me.state, router]);

  if (me.state === "error") return <p className="p-8 text-gray-700">Não foi possível carregar. Tente de novo.</p>;
  if (me.state !== "authenticated") return <p className="p-8 text-gray-500">Carregando...</p>;

  const profiles = profilesInUnit(me.me.profiles, unitId);
  const menu = panelMenu(profiles);
  const groups = GROUPS.map((g) => ({ ...g, items: menu.filter((i) => i.group === g.id) })).filter(
    (g) => g.items.length > 0,
  );
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  const initials = me.me.name
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
        <UnitInMenu />
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-semibold text-slate-400">{g.title}</p>
              {g.items.map((item) => {
                const Icon = MENU_ICONS[item.href] ?? CircleIcon;
                const current = active(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 font-bold text-white shadow-[0_3px_0_0_var(--color-primary-700)]"
                        : "flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    }
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={current ? 2.4 : 2} />
                    {item.label}
                    {item.href === "/agendamento" ? <MenuCounter active={current} /> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="m-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-extrabold text-primary-600">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{me.me.name}</p>
            <p className="truncate text-xs text-slate-500">{me.me.login}</p>
          </div>
          <Button
            variant="text"
            size="icon"
            aria-label="Sair"
            title="Sair"
            onClick={() => void leave(api, (href) => router.replace(href))}
          >
            <LogOutIcon />
          </Button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 px-10 py-8">
        <DialogsProvider>
          <ProtectedContent path={path} profiles={profiles}>
            {children}
          </ProtectedContent>
        </DialogsProvider>
      </main>
    </div>
  );
}
