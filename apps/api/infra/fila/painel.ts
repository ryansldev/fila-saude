import {
  type Acao,
  abrirSessao,
  conferirEMarcar,
  type DiaSessao,
  desfechoDaEntrada,
  encerrar,
  mesmoDia,
  origemDaSessao,
  temPrioridade,
} from "@fila-saude/domain";
import type { FilaDaSessao, HojeNaUnidade } from "@fila-saude/schemas/fila";
import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { exigirUnidade, SESSAO } from "infra/config/comum";
import { exigirSessao, paraSessao } from "infra/config/sessoes";
import database from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { entrada } from "infra/database/municipal/schema/entrada";
import { estacao } from "infra/database/municipal/schema/estacao";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { condicoesNaUnidade } from "infra/painel/guard";
import { lerDia, montarDia, naSessao } from "./dia";

// "52998224725" → "•••.982.247-••": o bastante para conferir com o documento sem expor o CPF inteiro.
const cpfMascarado = (cpf: string | null) => (cpf ? `•••.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-••` : null);

async function documentosDasEntradas(db: BancoDoTenant, ids: string[]) {
  if (ids.length === 0) return new Map<string, { nascimento: string; cpf: string | null }>();
  const linhas = await db
    .select({ id: entrada.id, nascimento: pessoaLocal.nascimento, cpf: pessoaLocal.cpf })
    .from(entrada)
    .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id))
    .where(inArray(entrada.id, ids));
  return new Map(linhas.map((l) => [l.id, { nascimento: l.nascimento, cpf: cpfMascarado(l.cpf) }]));
}

export async function nomesDasEntradas(db: BancoDoTenant, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const linhas = await db
    .select({ id: entrada.id, nome: pessoaLocal.nome })
    .from(entrada)
    .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id))
    .where(inArray(entrada.id, ids));
  return new Map(linhas.map((l) => [l.id, l.nome]));
}

async function paraFila(db: BancoDoTenant, sessaoId: string, dia: DiaSessao | null): Promise<FilaDaSessao> {
  const { s } = await exigirSessao(db, sessaoId);
  const itens = dia?.itens ?? [];
  const nomes = await nomesDasEntradas(
    db,
    itens.map((i) => i.entradaId),
  );
  const documentos = await documentosDasEntradas(
    db,
    itens.map((i) => i.entradaId),
  );
  const naReserva = (
    await db.select({ estado: entrada.estado }).from(entrada).where(eq(entrada.sessaoId, sessaoId))
  ).filter((e) => e.estado === "na_reserva").length;
  return {
    sessao: await paraSessao(db, s),
    itens: itens.map((i) => ({
      id: i.id,
      entradaId: i.entradaId,
      senha: i.senha,
      nome: nomes.get(i.entradaId) ?? "",
      etapa: i.etapa,
      estado: i.estado,
      pulos: i.pulos,
      risco: i.risco,
      prioridade: temPrioridade(i.prioridade),
      estacaoId: dia?.estacoes.find((e) => e.chamadoItemId === i.id)?.id ?? null,
      pendencias: i.pendencias,
      documento: documentos.get(i.entradaId) ?? { nascimento: "", cpf: null },
    })),
    reserva: naReserva,
  };
}

// Qualquer pessoa da equipe com papel na unidade (ou no município) vê a fila do dia (decisão F1).
export async function filaDaSessao(ctx: ContextoDaAcao, sessaoId: string): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  await daEquipeDaUnidade(ctx, servico.unidadeId);
  return paraFila(ctx.db, sessaoId, await lerDia(ctx.db, sessaoId));
}

// T3.4 / PD-33: abertura por botão; o worker chama a mesma função depois.
export async function abrirSessaoDoDia(ctx: ContextoDaAcao, sessaoId: string): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  return executarAcao(
    ctx,
    {
      acao: SESSAO,
      alvo: { tipo: "sessao", id: sessaoId },
      unidadeId: servico.unidadeId,
      dados: () => ({ evento: "abrir" }),
    },
    async (tx) => {
      const dia = await naSessao(tx, sessaoId, async (c) => {
        if (c.linha.estado !== "planejada") throw new ErroApi(409, "transicao_proibida");
        const r = abrirSessao(
          c.dia ?? (await montarDia(tx, sessaoId)),
          c.sessao,
          c.entradas,
          { servico: c.servico, fotosAceitas: [] },
          ctx.agora,
        );
        if (!r.ok) throw new ErroApi(409, r.erro);
        return { dia: r.estado.dia, sessao: r.estado.sessao, entradas: r.estado.entradas, resultado: r.estado.dia };
      });
      return paraFila(tx, sessaoId, dia);
    },
  );
}

// T3.9 / RN-SES-01..03: encerrar só sem estação com chamado; remanejados e faltas pelo domínio.
export async function encerrarSessaoDoDia(ctx: ContextoDaAcao, sessaoId: string): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  return executarAcao(
    ctx,
    {
      acao: SESSAO,
      alvo: { tipo: "sessao", id: sessaoId },
      unidadeId: servico.unidadeId,
      dados: () => ({ evento: "encerrar" }),
    },
    async (tx) => {
      const dia = await naSessao(tx, sessaoId, async (c) => {
        if (!c.dia || c.dia.estado !== "aberta") throw new ErroApi(409, "transicao_proibida");
        const r = encerrar(c.dia, c.entradas, ctx.agora, {
          semSinalSemContingencia: false,
          origem: origemDaSessao(c.sessao, c.servico),
        });
        if (!r.ok) throw new ErroApi(409, r.erro);
        return { dia: r.estado.dia, entradas: r.estado.entradas, resultado: r.estado.dia };
      });
      return paraFila(tx, sessaoId, dia);
    },
  );
}

// RN-FILA-05 / RN-ID-05: a recepção confere e marca a presença na mesma ação (quem teve o QR recusado).
// A conferência fica: o dono da conta fica verificado na central; outra pessoa, conferida na unidade.
export async function marcarPresencaNaFila(
  ctx: ContextoDaAcao,
  sessaoId: string,
  dados: {
    entradaId: string;
    resultado: "confere" | "nao_confere" | "prioridade_nao_confere";
    motivo?: string | undefined;
  },
  municipioId: string | null = null,
): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  let contaVerificada: string | null = null;
  const fila = await executarAcao(
    ctx,
    {
      acao: "conferir_e_marcar_presenca",
      alvo: { tipo: "entrada", id: dados.entradaId },
      unidadeId: servico.unidadeId,
      motivo: dados.motivo ?? null,
      // Recusar a validação tira a pessoa da fila: sempre com motivo.
      exigeMotivo: dados.resultado === "nao_confere",
      dados: () => ({ resultado: dados.resultado }),
    },
    async (tx) => {
      const dia = await naSessao(tx, sessaoId, async (c) => {
        const item = c.dia?.itens.find((i) => i.entradaId === dados.entradaId);
        if (!c.dia || !item) throw new ErroApi(404, "nao_encontrado");
        const cmd = { itemId: item.id, resultado: dados.resultado, ...(dados.motivo ? { motivo: dados.motivo } : {}) };
        const r = conferirEMarcar(c.dia, cmd, ctx.agora);
        if (!r.ok) throw new ErroApi(409, r.erro);
        const entradas = c.entradas.map((en) => {
          const it = r.estado.itens.find((i) => i.entradaId === en.id);
          if (!it || en.estado !== "na_fila") return en;
          const d = desfechoDaEntrada(en, it);
          return d.ok ? d.estado : en;
        });
        return { dia: r.estado, entradas, resultado: r.estado };
      });
      if (dados.resultado !== "nao_confere") {
        const [linha] = await tx
          .select({
            pessoaId: pessoaLocal.id,
            pacienteId: pessoaLocal.pacienteId,
            responsavel: entrada.responsavelPacienteId,
          })
          .from(entrada)
          .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id))
          .where(eq(entrada.id, dados.entradaId));
        if (linha?.pacienteId && linha.pacienteId === linha.responsavel) contaVerificada = linha.pacienteId;
        else if (linha)
          await tx
            .update(pessoaLocal)
            .set({ documentoConferidoPor: ctx.ator.usuarioId, documentoConferidoEm: new Date(ctx.agora) })
            .where(eq(pessoaLocal.id, linha.pessoaId));
      }
      return paraFila(tx, sessaoId, dia);
    },
  );
  if (contaVerificada) {
    await database
      .update(paciente)
      .set({ verificadoEm: new Date(ctx.agora), verificadoMetodo: "recepcao", verificadoMunicipio: municipioId })
      .where(and(eq(paciente.id, contaVerificada), isNull(paciente.verificadoEm)));
  }
  return fila;
}

// F1 (revisto): a fila do dia é de quem tem, na unidade, alguma ação dela (como o menu do painel).
export const ACOES_DA_FILA: Acao[] = [
  "abrir_cancelar_encerrar_sessao",
  "conferir_e_marcar_presenca",
  "operar_chamadas",
];

async function daEquipeDaUnidade(ctx: ContextoDaAcao, unidadeId: string) {
  for (const acao of ACOES_DA_FILA) {
    if (condicoesNaUnidade(ctx.ator.perfis, acao, unidadeId) !== null) return;
  }
  throw new ErroApi(403, "sem_permissao");
}

// F1: sessões de hoje (dia local da unidade) e estações, para quem tem ação da fila na unidade.
export async function hojeNaUnidade(ctx: ContextoDaAcao, unidadeId: string): Promise<HojeNaUnidade> {
  const u = await exigirUnidade(ctx.db, unidadeId);
  await daEquipeDaUnidade(ctx, unidadeId);
  const linhas = await ctx.db
    .select({ s: sessao, servico: servico.nome })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .where(
      and(
        eq(servico.unidadeId, unidadeId),
        // Sessão aberta de outro dia continua aqui até alguém encerrar (senão ficaria presa).
        or(
          eq(sessao.estado, "aberta"),
          and(
            gt(sessao.fim, new Date(ctx.agora - 36 * 3600_000)),
            lt(sessao.inicio, new Date(ctx.agora + 36 * 3600_000)),
          ),
        ),
      ),
    )
    .orderBy(asc(sessao.inicio));
  const sessoes = [];
  for (const { s, servico: nome } of linhas) {
    if (s.estado === "cancelada") continue;
    if (s.estado !== "aberta" && !mesmoDia(s.inicio.getTime(), ctx.agora, u.fuso)) continue;
    sessoes.push({ ...(await paraSessao(ctx.db, s)), servico: nome });
  }
  const estacoes = await ctx.db
    .select({ id: estacao.id, nome: estacao.nome, etapa: estacao.etapa })
    .from(estacao)
    .where(and(eq(estacao.unidadeId, unidadeId), isNull(estacao.arquivadaEm)))
    .orderBy(asc(estacao.criadoEm));
  return { sessoes, estacoes };
}
