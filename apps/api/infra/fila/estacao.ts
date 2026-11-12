import {
  type Acao,
  chamarProximo,
  type DiaSessao,
  desfechoDaEntrada,
  type Entrada,
  elegiveis,
  finalizar,
  naoCompareceu,
  type Resultado,
  rechamar,
  toleranciaEsgotada,
} from "@fila-saude/domain";
import type { ComandoEstacao, OperacaoEstacao } from "@fila-saude/schemas/fila";
import { and, asc, eq } from "drizzle-orm";
import { exigirEstacao } from "infra/config/estacoes";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao, sessaoEstacao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { permitido, type Ressalvas } from "infra/painel/guard";
import { lerDia, naSessao } from "./dia";
import { nomesDasEntradas } from "./painel";

export const OPERAR: Acao = "operar_chamadas";

type LinhaEstacao = Awaited<ReturnType<typeof exigirEstacao>>;

// PD-46: as ressalvas de `operar_chamadas` são a etapa da estação.
const ressalvasDa = (e: LinhaEstacao): Ressalvas => ({
  "acolhimento na triagem": () => e.etapa === "triagem",
  atendimento: () => e.etapa === "atendimento",
});

async function sessaoAberta(db: BancoDoTenant, estacaoId: string) {
  const [linha] = await db
    .select({ id: sessao.id, servico: servico.nome, estado: sessao.estado })
    .from(sessaoEstacao)
    .innerJoin(sessao, eq(sessaoEstacao.sessaoId, sessao.id))
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .where(and(eq(sessaoEstacao.estacaoId, estacaoId), eq(sessao.estado, "aberta")))
    .orderBy(asc(sessao.inicio))
    .limit(1);
  return linha ?? null;
}

async function montar(
  db: BancoDoTenant,
  e: LinhaEstacao,
  s: { id: string; servico: string; estado: string } | null,
  dia: DiaSessao | null,
  agora: number,
  aviso: OperacaoEstacao["aviso"] = null,
): Promise<OperacaoEstacao> {
  const est = dia?.estacoes.find((x) => x.id === e.id);
  const item = est?.chamadoItemId ? dia?.itens.find((i) => i.id === est.chamadoItemId) : undefined;
  const nomes = await nomesDasEntradas(db, item ? [item.entradaId] : []);
  const ultima = item && dia?.chamadas.findLast((ch) => ch.itemId === item.id && ch.etapa === item.etapa);
  return {
    estacao: { id: e.id, nome: e.nome, etapa: e.etapa },
    sessao: s,
    chamado:
      item && dia
        ? {
            itemId: item.id,
            senha: item.senha,
            nome: nomes.get(item.entradaId) ?? "",
            etapa: item.etapa,
            pulos: item.pulos,
            chamadoEm: new Date(ultima ? ultima.em : agora).toISOString(),
            toleranciaEsgotada: toleranciaEsgotada(dia, e.id, agora),
          }
        : null,
    aguardando: dia && est ? elegiveis(dia, e.id).length : 0,
    remotos: dia ? dia.itens.filter((i) => i.estado === "remoto" && i.etapa === e.etapa).length : 0,
    toleranciaMin: dia?.config.toleranciaMin ?? 0,
    aviso,
  };
}

export async function operacaoDaEstacao(ctx: ContextoDaAcao, estacaoId: string): Promise<OperacaoEstacao> {
  const e = await exigirEstacao(ctx.db, estacaoId);
  if (!(await permitido(ctx.ator.perfis, OPERAR, e.unidadeId, ressalvasDa(e)))) throw new ErroApi(403, "sem_permissao");
  const s = await sessaoAberta(ctx.db, estacaoId);
  return montar(ctx.db, e, s, s ? await lerDia(ctx.db, s.id) : null, ctx.agora);
}

// Itens que ficaram finais nesta ação fecham a entrada (desfechoDaEntrada).
function fecharEntradas(dia: DiaSessao, entradas: Entrada[]): Entrada[] {
  return entradas.map((en) => {
    const item = dia.itens.find((i) => i.entradaId === en.id);
    if (!item || en.estado !== "na_fila") return en;
    const r = desfechoDaEntrada(en, item);
    return r.ok ? r.estado : en;
  });
}

const COMANDOS: Record<
  ComandoEstacao,
  (d: DiaSessao, cmd: { estacaoId: string }, agora: number) => Resultado<DiaSessao>
> = {
  chamar: chamarProximo,
  rechamar,
  finalizar,
  "nao-compareceu": naoCompareceu,
};

// T3.7 / RN-CHAM: o comando trava a sessão (INV-04) e passa pelo guard e pela auditoria.
export async function comandoNaEstacao(
  ctx: ContextoDaAcao,
  estacaoId: string,
  comando: ComandoEstacao,
): Promise<OperacaoEstacao> {
  const e = await exigirEstacao(ctx.db, estacaoId);
  return executarAcao(
    ctx,
    {
      acao: OPERAR,
      alvo: { tipo: "estacao", id: estacaoId },
      unidadeId: e.unidadeId,
      ressalvas: ressalvasDa(e),
      dados: (r) => ({ comando, senha: r.chamado?.senha ?? null }),
    },
    async (tx) => {
      const s = await sessaoAberta(tx, estacaoId);
      if (!s) throw new ErroApi(409, "sessao_fechada", undefined, "Nenhuma sessão aberta nesta estação.");
      return naSessao(tx, s.id, async (c) => {
        if (!c.dia) throw new ErroApi(409, "sessao_fechada");
        const r = COMANDOS[comando](c.dia, { estacaoId }, ctx.agora);
        if (!r.ok) {
          if (r.erro === "nenhum_elegivel" && comando === "chamar") {
            return { resultado: await montar(tx, e, s, c.dia, ctx.agora, "ninguem_aguardando") };
          }
          throw new ErroApi(409, r.erro);
        }
        const dia = r.estado;
        const ninguem = comando === "chamar" && !dia.estacoes.find((x) => x.id === estacaoId)?.chamadoItemId;
        return {
          dia,
          entradas: fecharEntradas(dia, c.entradas),
          resultado: await montar(tx, e, s, dia, ctx.agora, ninguem ? "ninguem_aguardando" : null),
        };
      });
    },
  );
}
