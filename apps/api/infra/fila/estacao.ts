import {
  type Acao,
  chamarProximo,
  compareceu,
  compareceuEm,
  type DiaSessao,
  desfazerCompareceu,
  desfechoDaEntrada,
  type Entrada,
  type Evento,
  elegiveis,
  finalizar,
  type ItemFila,
  type NivelRisco,
  naoCompareceu,
  primeiroNome,
  type Resultado,
  rechamar,
  TEMPO_ALVO_MIN,
  toleranciaEsgotada,
} from "@fila-saude/domain";
import type { ComandoEstacao, OperacaoEstacao } from "@fila-saude/schemas/fila";
import { and, desc, eq, inArray } from "drizzle-orm";
import { exigirEstacao } from "infra/config/estacoes";
import { entrada } from "infra/database/municipal/schema/entrada";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao, sessaoEstacao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { permitido, type Ressalvas } from "infra/painel/guard";
import { lerDia, naSessao } from "./dia";
import { nomesDasEntradas } from "./painel";

const NA_FILA = 3;
/** Sem cor confirmada (ainda não triado), o tempo-alvo da pílula "o mais antigo". */
const ALVO_SEM_COR_MIN = 30;

const tempoAlvo = (i: ItemFila): number =>
  i.urgenciaConfirmada || i.atendidoEmEtapas.includes("triagem") ? TEMPO_ALVO_MIN[i.risco] : ALVO_SEM_COR_MIN;

async function prioridadeDa(db: BancoDoTenant, entradaId: string): Promise<string[]> {
  const [e] = await db.select({ p: entrada.prioridade }).from(entrada).where(eq(entrada.id, entradaId));
  return e?.p.grupos ?? [];
}

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
    .orderBy(desc(sessao.inicio))
    .limit(1);
  return linha ?? null;
}

// RN-RISCO-01/06: a ficha que a triagem precisa para classificar; só na estação de triagem.
async function fichaDaTriagem(db: BancoDoTenant, entradaId: string) {
  const [e] = await db
    .select({ c: entrada.classificacao, p: entrada.prioridade })
    .from(entrada)
    .where(inArray(entrada.id, [entradaId]));
  if (!e) return undefined;
  return { riscoSugerido: e.c.nivel, regra: e.c.regra, apoio: e.c.apoio, prioridade: e.p.grupos };
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
  const fila = dia && est ? elegiveis(dia, e.id) : [];
  const remotos = dia ? dia.itens.filter((i) => i.estado === "remoto" && i.etapa === e.etapa) : [];
  const aCaminho = [...remotos].sort((a, b) => a.numero - b.numero).slice(0, NA_FILA);
  const proximos = fila.slice(0, NA_FILA);
  const nomes = await nomesDasEntradas(db, [
    ...(item ? [item.entradaId] : []),
    ...proximos.map((i) => i.entradaId),
    ...aCaminho.map((i) => i.entradaId),
  ]);
  const curto = (i: ItemFila) => primeiroNome(nomes.get(i.entradaId) ?? "");
  const desde = (i: ItemFila) => new Date(i.presenteDesde ?? agora).toISOString();
  const antigo = fila
    .filter((i) => i.presenteDesde != null)
    .reduce<ItemFila | null>((m, i) => (m === null || (i.presenteDesde ?? 0) < (m.presenteDesde ?? 0) ? i : m), null);
  const veio = dia && item ? compareceuEm(dia, e.id) : null;
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
            compareceuEm: veio === null ? null : new Date(veio).toISOString(),
            prioridade: await prioridadeDa(db, item.entradaId),
            ...(e.etapa === "triagem" ? { triagem: await fichaDaTriagem(db, item.entradaId) } : {}),
          }
        : null,
    aguardando: fila.length,
    remotos: remotos.length,
    proximos: proximos.map((i) => ({ senha: i.senha, nome: curto(i), presenteDesde: desde(i) })),
    aCaminho: aCaminho.map((i) => ({ senha: i.senha, nome: curto(i) })),
    maisAntigo: antigo ? { presenteDesde: desde(antigo), tempoAlvoMin: tempoAlvo(antigo) } : null,
    toleranciaMin: dia?.config.toleranciaMin ?? 0,
    aviso,
    agora: new Date(agora).toISOString(),
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

// INV-07: o risco que a triagem deu vai para a entrada (vermelho também, AD-059).
function comRiscoConfirmado(entradas: Entrada[], eventos: Evento[]): Entrada[] {
  const nivel = new Map<string, NivelRisco>();
  for (const ev of eventos) {
    if (!ev.entradaId) continue;
    if (ev.tipo === "risco_confirmado") nivel.set(ev.entradaId, ev.dados?.nivel as NivelRisco);
    if (ev.tipo === "encaminhado_emergencia") nivel.set(ev.entradaId, "emergencia");
  }
  return entradas.map((en) => (nivel.has(en.id) ? { ...en, riscoConfirmado: nivel.get(en.id) ?? null } : en));
}

const COMANDOS: Record<
  ComandoEstacao,
  (
    d: DiaSessao,
    cmd: { estacaoId: string; riscoConfirmado?: NivelRisco; encaminhar?: boolean },
    agora: number,
  ) => Resultado<DiaSessao>
> = {
  chamar: chamarProximo,
  rechamar,
  finalizar,
  "nao-compareceu": naoCompareceu,
  compareceu,
  "desfazer-compareceu": desfazerCompareceu,
};

// T3.7 / RN-CHAM: o comando trava a sessão (INV-04) e passa pelo guard e pela auditoria.
export async function comandoNaEstacao(
  ctx: ContextoDaAcao,
  estacaoId: string,
  comando: ComandoEstacao,
  corpo: { riscoConfirmado?: NivelRisco | undefined; encaminhar?: boolean | undefined } = {},
): Promise<OperacaoEstacao> {
  const { riscoConfirmado, encaminhar } = corpo;
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
        // H3: na triagem, quem sai do chamado sai classificado (só o enfermeiro confirma, AD-056).
        const fecha = comando === "chamar" || comando === "finalizar";
        const chamado = c.dia.estacoes.find((x) => x.id === estacaoId)?.chamadoItemId;
        if (e.etapa === "triagem" && fecha && chamado && riscoConfirmado === undefined) {
          throw new ErroApi(422, "classifique_o_risco", undefined, "Escolha a cor da classificação de risco.");
        }
        const extra =
          fecha && chamado
            ? { ...(riscoConfirmado ? { riscoConfirmado } : {}), ...(encaminhar ? { encaminhar } : {}) }
            : {};
        const r = COMANDOS[comando](c.dia, { estacaoId, ...extra }, ctx.agora);
        if (!r.ok) {
          if (r.erro === "nenhum_elegivel" && comando === "chamar") {
            return { resultado: await montar(tx, e, s, c.dia, ctx.agora, "ninguem_aguardando") };
          }
          if (r.erro === "sem_comparecimento") {
            throw new ErroApi(409, r.erro, undefined, "Marque Compareceu antes de classificar.");
          }
          throw new ErroApi(409, r.erro);
        }
        const dia = r.estado;
        const ninguem = comando === "chamar" && !dia.estacoes.find((x) => x.id === estacaoId)?.chamadoItemId;
        return {
          dia,
          entradas: fecharEntradas(dia, comRiscoConfirmado(c.entradas, r.eventos)),
          eventos: r.eventos,
          resultado: await montar(tx, e, s, dia, ctx.agora, ninguem ? "ninguem_aguardando" : null),
        };
      });
    },
  );
}
