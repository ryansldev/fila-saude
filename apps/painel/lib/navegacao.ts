import { type Acao, type Perfil, pode } from "@fila-saude/domain";

export type ItemDeMenu = { rotulo: string; href: string };
export type PerfilDoUsuario = { perfil: Perfil; unidadeId: string | null };

/** Item aparece para quem pode alguma das ações. */
export type Candidato = ItemDeMenu & { acoes: Acao[] };

const UNIDADES: Acao = "criar_unidades_e_regras";
const EQUIPE: Acao = "cadastrar_equipe";
const CONFIGURAR: Acao = "configurar_servicos_sessoes_estacoes_tv";
const SESSAO: Acao = "abrir_cancelar_encerrar_sessao";
const PRESENCA: Acao = "conferir_e_marcar_presenca";
const OPERAR: Acao = "operar_chamadas";

export const ITENS_DO_MENU: Candidato[] = [
  { rotulo: "Unidades", href: "/unidades", acoes: [UNIDADES] },
  { rotulo: "Equipe", href: "/equipe", acoes: [EQUIPE] },
  { rotulo: "Serviços", href: "/servicos", acoes: [CONFIGURAR] },
  { rotulo: "Estações", href: "/estacoes", acoes: [CONFIGURAR] },
  { rotulo: "Sessões", href: "/sessoes", acoes: [CONFIGURAR] },
  { rotulo: "TVs", href: "/tvs", acoes: [CONFIGURAR] },
  { rotulo: "Fila do dia", href: "/fila", acoes: [SESSAO, PRESENCA, OPERAR] },
  { rotulo: "QR de entrada", href: "/qr", acoes: [PRESENCA, SESSAO] },
  { rotulo: "Estação", href: "/estacao", acoes: [OPERAR] },
];

const EM_BREVE: ItemDeMenu = { rotulo: "Em breve", href: "/em-breve" };

/**
 * Menu do painel (PD-09, `specs/permissoes`): cada item só aparece se `pode` permitir a ação dele.
 * Papéis acumulam; quem tem papel no painel mas nenhum item ganha um único "Em breve" até as próximas fatias.
 */
export function menuDoPainel(perfis: PerfilDoUsuario[]): ItemDeMenu[] {
  const lista = perfis.map((p) => p.perfil);
  const menu: ItemDeMenu[] = ITENS_DO_MENU.filter((c) => c.acoes.some((a) => pode(lista, a))).map(
    ({ rotulo, href }) => ({ rotulo, href }),
  );
  if (menu.length === 0 && lista.some((p) => p !== "paciente")) menu.push(EM_BREVE);
  return menu;
}

/**
 * RN-PERF-01 no front: a página de um item do menu (e os subcaminhos dela) só abre para quem pode a ação
 * do item. "Em breve" é de quem está logado; caminho fora do menu segue (o 404 do Next responde).
 * A API confere de novo: isto só evita mostrar a tela.
 */
export function podeAcessar(caminho: string, perfis: PerfilDoUsuario[]): boolean {
  const item = ITENS_DO_MENU.find((c) => caminho === c.href || caminho.startsWith(`${c.href}/`));
  if (!item) return true;
  const lista = perfis.map((p) => p.perfil);
  return item.acoes.some((a) => pode(lista, a));
}
