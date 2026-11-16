import { entradaAtivaDa, type Respostas, refazerQuestionario } from "@fila-saude/domain";
import type { InscricaoEntrada, ServicoDaUnidade } from "@fila-saude/schemas/fila";
import { and, asc, eq, isNull, notInArray } from "drizzle-orm";
import type { PacienteAutenticado } from "infra/auth/sessao-paciente";
import { entrada } from "infra/database/municipal/schema/entrada";
import { servico } from "infra/database/municipal/schema/servico";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant, DbDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { responderAlocacao } from "./agendamento";
import { MAX_POR_CONTA, pessoaDoPedido } from "./app";
import { configDaUnidade } from "./dia";
import { atualizarEntrada, entradasAtivasDoServico, entrarNaLista, lerEntrada, pessoaPorCpf } from "./entradas";

const FINAIS = ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"] as const;
/** I9: refazer o questionário pelo app só na lista; no dia vale "meus sintomas pioraram" (H6). */
const NA_LISTA = ["aguardando", "alocada", "confirmada"];

// I1: serviços ativos da unidade (não removida), com o modo de marcação; o app decide o que oferecer.
export async function servicosDaUnidade(db: DbDoTenant, unidadeId: string): Promise<ServicoDaUnidade[]> {
  const linhas = await db
    .select({ id: servico.id, nome: servico.nome, modo: servico.modo })
    .from(servico)
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .where(and(eq(servico.unidadeId, unidadeId), eq(servico.ativo, true), isNull(unidade.arquivadaEm)))
    .orderBy(asc(servico.nome));
  return linhas;
}

async function servicoAtivo(db: BancoDoTenant, servicoId: string) {
  const [linha] = await db
    .select({ s: servico, u: unidade })
    .from(servico)
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .where(eq(servico.id, servicoId));
  if (!linha || !linha.s.ativo || linha.u.arquivadaEm !== null) throw new ErroApi(404, "nao_encontrado");
  return linha;
}

/**
 * T5.1 / RN-LE-01..05: o paciente entra na lista de espera de um serviço, para si ou para outra pessoa.
 * Serviço com requisição espera a T5.2 (I2); vínculo e pré-cadastro ficam para a fatia 5 (I3).
 * A duplicada só mostra a entrada existente à conta responsável por ela.
 */
export async function entrarNaListaPeloApp(
  db: DbDoTenant,
  p: PacienteAutenticado,
  servicoId: string,
  dados: InscricaoEntrada,
  agora: number,
) {
  const pessoa = await pessoaDoPedido(p, dados.paraQuem);
  return db.transaction(async (tx) => {
    const { s } = await servicoAtivo(tx, servicoId);
    if (s.modo === "requisicao")
      throw new ErroApi(
        409,
        "requisicao_em_breve",
        undefined,
        "Este serviço pede a requisição do médico. Por enquanto, leve o papel à recepção da unidade.",
      );
    // Como na inscrição: o CPF é conferido antes de dizer se a pessoa já está na lista.
    await pessoaPorCpf(tx, pessoa);
    const daConta = await tx
      .select({ id: entrada.id })
      .from(entrada)
      .where(
        and(
          eq(entrada.servicoId, servicoId),
          eq(entrada.responsavelPacienteId, p.pacienteId),
          notInArray(entrada.estado, [...FINAIS]),
        ),
      );
    if (daConta.length >= MAX_POR_CONTA)
      throw new ErroApi(
        409,
        "limite_por_conta",
        undefined,
        `Uma conta põe até ${MAX_POR_CONTA} pessoas na lista de um serviço. Para mais, procure a recepção.`,
      );
    const r = await entrarNaLista(tx, {
      servicoId,
      pessoa,
      responsavelPacienteId: p.pacienteId,
      respostas: dados.respostas,
      agora,
    });
    if (!r.ok) {
      if (r.erro === "duplicada") {
        const existente = entradaAtivaDa(await entradasAtivasDoServico(tx, servicoId), pessoa, servicoId);
        const minha = existente?.responsavelId === p.pacienteId;
        throw new ErroApi(
          409,
          "duplicada",
          undefined,
          "Essa pessoa já está na lista deste serviço.",
          minha ? { entradaId: existente.id } : undefined,
        );
      }
      throw new ErroApi(409, r.erro);
    }
    const e = r.estado;
    return {
      entradaId: e.id,
      estado: e.estado,
      classificacao: { nivel: e.classificacao.nivel, apoio: e.classificacao.apoio },
    };
  });
}

/** RN-RISCO-03 / I9: a conta responsável refaz o questionário de quem está na lista. */
export async function refazerQuestionarioDoPaciente(
  db: DbDoTenant,
  pacienteId: string,
  entradaId: string,
  respostas: Respostas,
  agora: number,
) {
  return db.transaction(async (tx) => {
    const [linha] = await tx
      .select({ id: entrada.id, servicoId: entrada.servicoId })
      .from(entrada)
      .where(and(eq(entrada.id, entradaId), eq(entrada.responsavelPacienteId, pacienteId)))
      .for("update");
    if (!linha) throw new ErroApi(404, "nao_encontrado");
    const e = await lerEntrada(tx, entradaId);
    if (!e) throw new ErroApi(404, "nao_encontrado");
    if (!NA_LISTA.includes(e.estado)) throw new ErroApi(409, "transicao_proibida");
    const { u } = await servicoAtivo(tx, linha.servicoId);
    const r = refazerQuestionario(e, null, { respostas }, agora, configDaUnidade(u));
    if (!r.ok) throw new ErroApi(409, r.erro);
    await atualizarEntrada(tx, r.estado.entrada);
    const c = r.estado.entrada.classificacao;
    return { classificacao: { nivel: c.nivel, apoio: c.apoio } };
  });
}

/** RN-CONF-01/04: a conta responsável confirma ou recusa a alocação pelo app. */
export async function responderDoPaciente(
  db: DbDoTenant,
  pacienteId: string,
  entradaId: string,
  resposta: "confirmou" | "recusou",
  agora: number,
) {
  const [linha] = await db
    .select({ sessaoId: entrada.sessaoId })
    .from(entrada)
    .where(and(eq(entrada.id, entradaId), eq(entrada.responsavelPacienteId, pacienteId)));
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  const { sessaoId } = linha;
  if (!sessaoId) throw new ErroApi(409, "transicao_proibida");
  return db.transaction((tx) => responderAlocacao(tx, sessaoId, entradaId, resposta, agora));
}
