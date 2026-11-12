import { type Acao, type Perfil, pode } from "@fila-saude/domain";

export type ItemDeMenu = { rotulo: string; href: string };
export type PerfilDoUsuario = { perfil: Perfil; unidadeId: string | null };

export type Candidato = ItemDeMenu & { acao: Acao };

const UNIDADES: Acao = "criar_unidades_e_regras";
const EQUIPE: Acao = "cadastrar_equipe";
const CONFIGURAR: Acao = "configurar_servicos_sessoes_estacoes_tv";

export const ITENS_DO_MENU: Candidato[] = [
  { rotulo: "Unidades", href: "/unidades", acao: UNIDADES },
  { rotulo: "Equipe", href: "/equipe", acao: EQUIPE },
  { rotulo: "Serviços", href: "/servicos", acao: CONFIGURAR },
  { rotulo: "Estações", href: "/estacoes", acao: CONFIGURAR },
  { rotulo: "Sessões", href: "/sessoes", acao: CONFIGURAR },
];

const EM_BREVE: ItemDeMenu = { rotulo: "Em breve", href: "/em-breve" };

/**
 * Menu do painel (PD-09, `specs/permissoes`): cada item só aparece se `pode` permitir a ação dele.
 * Papéis acumulam; quem não é gestão SMS, gerente da UBS nem paciente ganha um único item "Em breve" até as próximas fatias.
 */
export function menuDoPainel(perfis: PerfilDoUsuario[]): ItemDeMenu[] {
  const lista = perfis.map((p) => p.perfil);
  const menu: ItemDeMenu[] = ITENS_DO_MENU.filter((c) => pode(lista, c.acao)).map(({ rotulo, href }) => ({
    rotulo,
    href,
  }));
  if (lista.some((p) => p !== "gestao_sms" && p !== "gerente_ubs" && p !== "paciente")) menu.push(EM_BREVE);
  return menu;
}
