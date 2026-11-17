import { type Action, can, type Profile } from "@fila-saude/domain";
import {
  Building2Icon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClockIcon,
  DoorOpenIcon,
  type LucideIcon,
  MegaphoneIcon,
  QrCodeIcon,
  StethoscopeIcon,
  TvIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";

/** Seções da barra lateral: o dia a dia na unidade e a configuração. */
export type MenuGroup = "care" | "configuration";
export type MenuItem = { label: string; href: string; group: MenuGroup };
export type UserProfile = { profile: Profile; unitId: string | null };

/** Item aparece para quem pode alguma das ações. */
export type Candidate = MenuItem & { actions: Action[] };

const UNITS: Action = "create_units_and_rules";
const STAFF: Action = "register_staff";
const CONFIGURE: Action = "configure_services_sessions_stations_tv";
const SESSION: Action = "open_cancel_close_session";
const ATTENDANCE: Action = "verify_and_mark_attendance";
const OPERATE: Action = "operate_calls";
const SCHEDULE: Action = "allocate_confirm_refuse_for_patient";

export const MENU_ITEMS: Candidate[] = [
  { label: "Unidades", href: "/unidades", group: "configuration", actions: [UNITS] },
  { label: "Equipe", href: "/equipe", group: "configuration", actions: [STAFF] },
  { label: "Serviços", href: "/servicos", group: "configuration", actions: [CONFIGURE] },
  { label: "Estações", href: "/estacoes", group: "configuration", actions: [CONFIGURE] },
  { label: "Sessões", href: "/sessoes", group: "configuration", actions: [CONFIGURE] },
  { label: "TVs", href: "/tvs", group: "configuration", actions: [CONFIGURE] },
  { label: "Fila do dia", href: "/fila", group: "care", actions: [SESSION, ATTENDANCE, OPERATE] },
  { label: "QR de entrada", href: "/qr", group: "care", actions: [ATTENDANCE, SESSION] },
  { label: "Estação", href: "/estacao", group: "care", actions: [OPERATE] },
  { label: "Agendamento", href: "/agendamento", group: "care", actions: [SCHEDULE] },
];

/** O ícone de cada item do menu (e do "Em breve"); todo item tem um. */
export const MENU_ICONS: Record<string, LucideIcon> = {
  "/fila": UsersRoundIcon,
  "/estacao": MegaphoneIcon,
  "/agendamento": CalendarCheckIcon,
  "/qr": QrCodeIcon,
  "/unidades": Building2Icon,
  "/equipe": UsersIcon,
  "/servicos": StethoscopeIcon,
  "/estacoes": DoorOpenIcon,
  "/sessoes": CalendarDaysIcon,
  "/tvs": TvIcon,
  "/em-breve": ClockIcon,
};

const COMING_SOON: MenuItem = { label: "Em breve", href: "/em-breve", group: "care" };

/**
 * Menu do painel (PD-09, `specs/permissoes`): cada item só aparece se `pode` permitir a ação dele.
 * Papéis acumulam; quem tem papel no painel mas nenhum item ganha um único "Em breve" até as próximas fatias.
 */
export function panelMenu(profiles: UserProfile[]): MenuItem[] {
  const list = profiles.map((p) => p.profile);
  const menu: MenuItem[] = MENU_ITEMS.filter((c) => c.actions.some((a) => can(list, a))).map(
    ({ label, href, group }) => ({ label, href, group }),
  );
  if (menu.length === 0 && list.some((p) => p !== "patient")) menu.push(COMING_SOON);
  return menu;
}

/**
 * RN-PERF-01 no front: a página de um item do menu (e os subcaminhos dela) só abre para quem pode a ação
 * do item. "Em breve" é de quem está logado; caminho fora do menu segue (o 404 do Next responde).
 * A API confere de novo: isto só evita mostrar a tela.
 */
export function canAccess(path: string, profiles: UserProfile[]): boolean {
  const item = MENU_ITEMS.find((c) => path === c.href || path.startsWith(`${c.href}/`));
  if (!item) return true;
  const list = profiles.map((p) => p.profile);
  return item.actions.some((a) => can(list, a));
}

/** Os perfis que valem na unidade escolhida: os dela e os do município (unidade nula); sem unidade, todos. */
export function profilesInUnit<P extends UserProfile>(profiles: P[], unitId: string | null): P[] {
  if (unitId === null) return profiles;
  return profiles.filter((p) => p.unitId === null || p.unitId === unitId);
}

/**
 * A página não vale na unidade escolhida, mas vale em outra unidade da pessoa (por exemplo, o destino
 * depois do login): a unidade para onde trocar, em vez de mostrar "Sem acesso". `null` = não troca.
 */
export function unitForPath<P extends UserProfile>(
  path: string,
  profiles: P[],
  unitIds: string[],
  current: string | null,
): string | null {
  if (canAccess(path, profilesInUnit(profiles, current))) return null;
  return unitIds.find((id) => id !== current && canAccess(path, profilesInUnit(profiles, id))) ?? null;
}
