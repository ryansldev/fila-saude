import {
  type Acao,
  alocar,
  type ConfigUnidade,
  confirmar,
  type Entrada,
  idadeEm,
  listaDeLigacao,
  mesmoDia,
  prazoConfirmacao,
  recusar,
  riscoVigente,
  sugerir,
} from "@fila-saude/domain";
import type { AlocacaoDaSessao, ItemDeLigacao, ListaDeEsperaDoServico } from "@fila-saude/schemas/fila";
import { and, asc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { exigirUnidade } from "infra/config/comum";
import database from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import { diaSessao } from "infra/database/municipal/schema/dia-sessao";
import { entrada } from "infra/database/municipal/schema/entrada";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant, TxDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { permitido } from "infra/painel/guard";
import { configDaUnidade, naSessao, paraSessaoVagas } from "./dia";
import { entradasAtivasDoServico, lerEntrada, travarEntrada } from "./entradas";

export const AGENDAR: Acao = "alocar_confirmar_recusar_pelo_paciente";
const DIA = 86400_000;
const FINAIS = ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"] as const;

const MENSAGENS: Record<string, string> = {
  sem_vaga: "A sessão não tem mais vaga. A lista foi atualizada.",
  transicao_proibida: "Essa pessoa já não está disponível para esta sessão. A lista foi atualizada.",
  fora_do_prazo: "A alocação vai até a véspera da sessão.",
  sessao_fechada: "Esta sessão não está mais planejada.",
};

const erro409 = (codigo: string) => new ErroApi(409, codigo, undefined, MENSAGENS[codigo]);

async function exigirAgendar(ctx: ContextoDaAcao, unidadeId: string) {
  if (!(await permitido(ctx.ator.perfis, AGENDAR, unidadeId))) throw new ErroApi(403, "sem_permissao");
}

async function sessaoComUnidade(db: BancoDoTenant, sessaoId: string) {
  const [linha] = await db
    .select({ s: sessao, srv: servico, u: unidade })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .where(eq(sessao.id, sessaoId));
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  return linha;
}

/**
 * RN-FALTA-03 / I10: faltas de cada pessoa atendida nos encerramentos da janela do alerta
 * (padrão 2 em 90 dias), pela pessoa local da entrada; sem a regra do titular (RN-ID-06) na v0.1.
 */
async function faltasPorEntrada(db: BancoDoTenant, entradaIds: string[], config: ConfigUnidade, agora: number) {
  const contagem = new Map<string, number>();
  if (entradaIds.length === 0) return contagem;
  const desde = agora - config.alertaFaltas.dias * DIA;
  const dias = await db
    .select({ faltas: sql<string[]>`${diaSessao.dia}->'encerramento'->'faltas'` })
    .from(diaSessao)
    .where(sql`(${diaSessao.dia}->'encerramento'->>'em')::bigint >= ${desde}`);
  const faltosas = dias.flatMap((d) => (d.faltas ?? []).map((itemId) => itemId.split("/")[1] ?? ""));
  if (faltosas.length === 0) return contagem;
  const pessoas = await db
    .select({ id: entrada.id, pessoa: entrada.pessoaLocalId })
    .from(entrada)
    .where(inArray(entrada.id, [...new Set([...faltosas, ...entradaIds])]));
  const pessoaDe = new Map(pessoas.map((p) => [p.id, p.pessoa]));
  const porPessoa = new Map<string, number>();
  for (const f of faltosas) {
    const p = pessoaDe.get(f);
    if (p) porPessoa.set(p, (porPessoa.get(p) ?? 0) + 1);
  }
  for (const id of entradaIds) contagem.set(id, porPessoa.get(pessoaDe.get(id) ?? "") ?? 0);
  return contagem;
}

function podeAlocarNa(
  s: typeof sessao.$inferSelect,
  config: ConfigUnidade,
  agora: number,
): { podeAlocar: boolean; motivo: string | null } {
  if (s.estado !== "planejada") return { podeAlocar: false, motivo: "A sessão não está mais planejada." };
  if (s.visibilidade !== "privada") return { podeAlocar: false, motivo: "Sessão pública: o paciente se inscreve." };
  const inicio = s.inicio.getTime();
  if (agora >= inicio || mesmoDia(agora, inicio, config.fuso))
    return { podeAlocar: false, motivo: "A alocação vai até a véspera da sessão." };
  if (s.vagas !== null && s.ocupadas >= s.vagas) return { podeAlocar: false, motivo: "Sem vagas livres." };
  return { podeAlocar: true, motivo: null };
}

async function montarAlocacao(db: BancoDoTenant, sessaoId: string, agora: number): Promise<AlocacaoDaSessao> {
  const { s, srv, u } = await sessaoComUnidade(db, sessaoId);
  const config = configDaUnidade(u);
  const vagas = paraSessaoVagas(s);
  const ativas = await entradasAtivasDoServico(db, srv.id);
  const naSessaoAgora = ativas.filter((e) => e.sessaoId === sessaoId);
  const sugestao =
    s.visibilidade === "privada" && s.estado === "planejada" ? sugerir(ativas, vagas, config, agora) : [];
  const porId = new Map(ativas.map((e) => [e.id, e]));
  const faltas = await faltasPorEntrada(
    db,
    sugestao.map((x) => x.entradaId),
    config,
    agora,
  );
  const idade = (e: Entrada) => idadeEm(e.pessoa.nascimento, agora, config.fuso);
  return {
    sessao: {
      id: s.id,
      servico: { id: srv.id, nome: srv.nome },
      inicio: s.inicio.toISOString(),
      fim: s.fim.toISOString(),
      vagas: s.vagas,
      ocupadas: s.ocupadas,
      estado: s.estado,
      visibilidade: s.visibilidade,
      ...podeAlocarNa(s, config, agora),
    },
    alocados: naSessaoAgora
      .sort((a, b) => (a.alocadaEm ?? 0) - (b.alocadaEm ?? 0) || a.dataEntradaOriginal - b.dataEntradaOriginal)
      .map((e) => {
        const prazo = e.estado === "alocada" ? prazoConfirmacao(e, vagas, config) : null;
        return {
          entradaId: e.id,
          nome: e.pessoa.nome,
          idade: idade(e),
          estado: e.estado,
          prazo: prazo === null ? null : new Date(prazo).toISOString(),
          destacada: prazo !== null && agora >= prazo,
        };
      }),
    sugestao: sugestao.flatMap(({ entradaId, motivos }) => {
      const e = porId.get(entradaId);
      if (!e) return [];
      const n = faltas.get(entradaId) ?? 0;
      return [
        {
          entradaId,
          nome: e.pessoa.nome,
          idade: idade(e),
          motivos,
          alerta: e.riscoConfirmado === null && e.classificacao.nivel === "urgente",
          autolesao: e.classificacao.apoio,
          faltas: n,
          alertaFaltas: n >= config.alertaFaltas.faltas,
          risco: { nivel: riscoVigente(e), confirmado: e.riscoConfirmado !== null, regra: e.classificacao.regra },
        },
      ];
    }),
  };
}

// T5.3: a sessão vista pelo agendador da unidade (leitura, sem auditoria).
export async function alocacaoDaSessao(ctx: ContextoDaAcao, sessaoId: string): Promise<AlocacaoDaSessao> {
  const { srv } = await sessaoComUnidade(ctx.db, sessaoId);
  await exigirAgendar(ctx, srv.unidadeId);
  return montarAlocacao(ctx.db, sessaoId, ctx.agora);
}

/**
 * T5.3 / RN-AL-04..06, INV-08: o agendador aloca uma entrada. Trava a sessão e a entrada; quem
 * chegou depois recebe 409 com a alocação atualizada (I7).
 */
export async function alocarNaSessao(ctx: ContextoDaAcao, sessaoId: string, entradaId: string) {
  const { srv } = await sessaoComUnidade(ctx.db, sessaoId);
  try {
    await executarAcao(
      ctx,
      {
        acao: AGENDAR,
        alvo: { tipo: "entrada", id: entradaId },
        unidadeId: srv.unidadeId,
        dados: () => ({ evento: "alocar", sessaoId }),
      },
      (tx) =>
        naSessao(tx, sessaoId, async (c) => {
          if (c.linha.estado !== "planejada") throw erro409("sessao_fechada");
          const e = await travarEntrada(c.tx, entradaId);
          const r = alocar(e, c.sessao, {}, ctx.agora, configDaUnidade(c.unidadeLinha));
          if (!r.ok) throw erro409(r.erro);
          return {
            sessao: r.estado.sessao,
            entradas: [...c.entradas, r.estado.entrada],
            eventos: r.eventos,
            resultado: null,
          };
        }),
    );
  } catch (err) {
    if (err instanceof ErroApi && err.status === 409) {
      err.dados = { alocacao: await montarAlocacao(ctx.db, sessaoId, Date.now()) };
    }
    throw err;
  }
  return montarAlocacao(ctx.db, sessaoId, ctx.agora);
}

export type Resposta = "confirmou" | "recusou" | "sem_contato";

/**
 * RN-CONF-01..04: a resposta à alocação, do paciente ou do agendador em nome dele. Confirmar mantém
 * a vaga; recusar a libera e a entrada volta à lista com a data original; "sem contato" só anota (I6).
 */
export async function responderAlocacao(
  tx: TxDoTenant,
  sessaoId: string,
  entradaId: string,
  resposta: Resposta,
  agora: number,
): Promise<{ estado: string }> {
  return naSessao(tx, sessaoId, async (c) => {
    const e = await travarEntrada(c.tx, entradaId);
    if (e.sessaoId !== sessaoId) throw new ErroApi(409, "transicao_proibida");
    if (resposta === "sem_contato") {
      if (e.estado !== "alocada") throw new ErroApi(409, "transicao_proibida");
      return { resultado: { estado: e.estado } };
    }
    const outras = c.entradas.filter((x) => x.id !== entradaId);
    if (resposta === "confirmou") {
      const r = confirmar(e, c.sessao, agora);
      if (!r.ok) throw new ErroApi(409, r.erro);
      return { entradas: [...outras, r.estado], eventos: r.eventos, resultado: { estado: r.estado.estado } };
    }
    const r = recusar(e, c.sessao, agora);
    if (!r.ok) throw new ErroApi(409, r.erro);
    return {
      sessao: r.estado.sessao,
      entradas: [...outras, r.estado.entrada],
      eventos: r.eventos,
      resultado: { estado: r.estado.entrada.estado },
    };
  });
}

async function entradaComUnidade(db: BancoDoTenant, entradaId: string) {
  const [linha] = await db
    .select({ sessaoId: entrada.sessaoId, unidadeId: servico.unidadeId })
    .from(entrada)
    .innerJoin(servico, eq(entrada.servicoId, servico.id))
    .where(eq(entrada.id, entradaId));
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  return linha;
}

// RN-CONF-02: o agendador registra a resposta depois de ligar.
export async function responderPeloAgendador(ctx: ContextoDaAcao, entradaId: string, resposta: Resposta) {
  const { sessaoId, unidadeId } = await entradaComUnidade(ctx.db, entradaId);
  await exigirAgendar(ctx, unidadeId);
  if (!sessaoId) throw new ErroApi(409, "transicao_proibida");
  return executarAcao(
    ctx,
    {
      acao: AGENDAR,
      alvo: { tipo: "entrada", id: entradaId },
      unidadeId,
      dados: () => ({ evento: "resposta", resposta, sessaoId }),
    },
    (tx) => responderAlocacao(tx, sessaoId, entradaId, resposta, ctx.agora),
  );
}

// RN-CONF-03: alocações pendentes da unidade, pela sessão mais próxima; com telefone e a última tentativa.
export async function ligacaoDaUnidade(ctx: ContextoDaAcao, unidadeId: string): Promise<ItemDeLigacao[]> {
  const u = await exigirUnidade(ctx.db, unidadeId);
  await exigirAgendar(ctx, unidadeId);
  const config = configDaUnidade(u);
  const linhas = await ctx.db
    .select({ id: entrada.id, sessaoId: entrada.sessaoId })
    .from(entrada)
    .innerJoin(servico, eq(entrada.servicoId, servico.id))
    .where(and(eq(servico.unidadeId, unidadeId), eq(entrada.estado, "alocada")));
  if (linhas.length === 0) return [];
  const entradas = (await Promise.all(linhas.map((l) => lerEntrada(ctx.db, l.id)))).filter(
    (e): e is Entrada => e !== null,
  );
  const sessaoIds = [...new Set(linhas.map((l) => l.sessaoId).filter((x): x is string => x !== null))];
  const sessoes = await ctx.db
    .select({ s: sessao, nome: servico.nome })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .where(inArray(sessao.id, sessaoIds));
  const itens = listaDeLigacao(
    entradas,
    sessoes.map((x) => paraSessaoVagas(x.s)),
    config,
    ctx.agora,
  );
  const responsaveis = [...new Set(entradas.map((e) => e.responsavelId).filter((x): x is string => x !== null))];
  const telefones = new Map(
    responsaveis.length === 0
      ? []
      : (
          await database
            .select({ id: paciente.id, telefone: paciente.telefone })
            .from(paciente)
            .where(inArray(paciente.id, responsaveis))
        ).map((p) => [p.id, p.telefone]),
  );
  const tentativas = await ctx.db
    .select({ alvo: auditoria.alvoId, em: auditoria.em })
    .from(auditoria)
    .where(
      and(
        eq(auditoria.alvoTipo, "entrada"),
        inArray(
          auditoria.alvoId,
          entradas.map((e) => e.id),
        ),
        sql`${auditoria.dados}->>'resposta' = 'sem_contato'`,
      ),
    );
  return itens.map((i) => {
    const e = entradas.find((x) => x.id === i.entradaId) as Entrada;
    const s = sessoes.find((x) => x.s.id === i.sessaoId);
    const ultima = tentativas
      .filter((t) => t.alvo === e.id && t.em.getTime() >= (e.alocadaEm ?? 0))
      .reduce<Date | null>((m, t) => (m && m > t.em ? m : t.em), null);
    return {
      entradaId: e.id,
      nome: e.pessoa.nome,
      telefone: e.responsavelId ? (telefones.get(e.responsavelId) ?? null) : null,
      servico: s?.nome ?? "",
      sessao: { id: i.sessaoId, inicio: (s?.s.inicio ?? new Date(0)).toISOString() },
      prazo: new Date(i.prazo).toISOString(),
      destacada: i.destacada,
      ultimaTentativa: ultima ? ultima.toISOString() : null,
    };
  });
}

// T5.3: a lista de espera da unidade por serviço, com as sessões privadas planejadas que vêm.
export async function listaDeEsperaDaUnidade(
  ctx: ContextoDaAcao,
  unidadeId: string,
): Promise<ListaDeEsperaDoServico[]> {
  await exigirUnidade(ctx.db, unidadeId);
  await exigirAgendar(ctx, unidadeId);
  const servicos = await ctx.db
    .select()
    .from(servico)
    .where(and(eq(servico.unidadeId, unidadeId), eq(servico.ativo, true)))
    .orderBy(asc(servico.nome));
  const saida: ListaDeEsperaDoServico[] = [];
  for (const srv of servicos) {
    const naLista = (
      await ctx.db
        .select({ estado: entrada.estado, classificacao: entrada.classificacao, risco: entrada.riscoConfirmado })
        .from(entrada)
        .where(and(eq(entrada.servicoId, srv.id), notInArray(entrada.estado, [...FINAIS])))
    ).filter((e) => e.estado === "aguardando" || e.estado === "remanejada");
    const sessoes = await ctx.db
      .select()
      .from(sessao)
      .where(
        and(
          eq(sessao.servicoId, srv.id),
          eq(sessao.visibilidade, "privada"),
          eq(sessao.estado, "planejada"),
          gt(sessao.inicio, new Date(ctx.agora)),
        ),
      )
      .orderBy(asc(sessao.inicio))
      .limit(20);
    saida.push({
      servico: { id: srv.id, nome: srv.nome, modo: srv.modo },
      aguardando: naLista.length,
      alertas: naLista.filter((e) => e.risco === null && e.classificacao.nivel === "urgente").length,
      sessoes: sessoes.map((s) => ({
        id: s.id,
        inicio: s.inicio.toISOString(),
        fim: s.fim.toISOString(),
        vagas: s.vagas,
        ocupadas: s.ocupadas,
        profissional: s.profissional,
      })),
    });
  }
  return saida;
}
