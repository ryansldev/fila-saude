import { type Acao, type Perfil, pode } from "@fila-saude/domain";

export type ItemDeMenu = { rotulo: string; href: string };
export type PerfilDoUsuario = { perfil: Perfil; unidadeId: string | null };

export type Candidato = ItemDeMenu & { acao: Acao };

const GESTAO: Acao = "criar_unidades_regras_usuarios";
const CONFIGURAR: Acao = "configurar_servicos_sessoes_estacoes_tv";

export const ITENS_DO_MENU: Candidato[] = [
  { rotulo: "Unidades", href: "/unidades", acao: GESTAO },
  { rotulo: "Usuários", href: "/usuarios", acao: GESTAO },
  { rotulo: "Regras do município", href: "/regras", acao: GESTAO },
  { rotulo: "Serviços", href: "/servicos", acao: CONFIGURAR },
  { rotulo: "Estações", href: "/estacoes", acao: CONFIGURAR },
  { rotulo: "Sessões", href: "/sessoes", acao: CONFIGURAR },
  { rotulo: "TVs", href: "/tvs", acao: CONFIGURAR },
];

const EM_BREVE: ItemDeMenu = { rotulo: "Em breve", href: "/em-breve" };

/**
 * Menu do painel (PD-09, `specs/permissoes`): cada item só aparece se `pode` permitir a ação dele.
 * Perfis acumulam; os que não são gestor, admin nem paciente (sem painel) ganham um único item "Em breve" até as fases 3–7.
 */
export function menuDoPainel(perfis: PerfilDoUsuario[]): ItemDeMenu[] {
  const lista = perfis.map((p) => p.perfil);
  const menu: ItemDeMenu[] = ITENS_DO_MENU.filter((c) => pode(lista, c.acao)).map(({ rotulo, href }) => ({
    rotulo,
    href,
  }));
  if (lista.some((p) => p !== "gestor" && p !== "admin" && p !== "paciente")) menu.push(EM_BREVE);
  return menu;
}
