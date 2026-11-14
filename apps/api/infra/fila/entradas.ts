import { randomUUID } from "node:crypto";
import {
  configEfetiva,
  criarEntrada,
  type Entrada,
  type EstadoEntrada,
  type Respostas,
  type Resultado,
} from "@fila-saude/domain";
import { and, eq, notInArray } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { entrada } from "infra/database/municipal/schema/entrada";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { servico } from "infra/database/municipal/schema/servico";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant, DbDoTenant, TxDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";

export type PessoaInformada = { nome: string; nascimento: string; cpf: string | null; pacienteId: string | null };

const FINAIS: EstadoEntrada[] = ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"];

const ms = (d: Date | null) => (d ? d.getTime() : null);
const data = (n: number | null) => (n === null ? null : new Date(n));

const primeiroNome = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)[0] ?? "";

/**
 * Quem informa um CPF já cadastrado precisa conhecer a pessoa: mesma data de nascimento e, para
 * "outra pessoa", mesmo primeiro nome. Senão, um CPF bastaria para ver o nome de alguém, ocupar a vaga
 * dele ou herdar a conferência de documentos (revisão 2026-11-13). A resposta não diz qual dado diverge.
 * Roda antes de qualquer outra checagem (inclusive "duplicada"), para não confirmar que o CPF está na fila.
 */
export async function pessoaPorCpf(db: BancoDoTenant, p: PessoaInformada) {
  if (!p.cpf) return null;
  const [existente] = await db.select().from(pessoaLocal).where(eq(pessoaLocal.cpf, p.cpf));
  if (!existente) return null;
  // O dono do CPF criando a conta assume o cadastro feito por terceiros ("outra pessoa"), com os dados
  // da conta: dados errados digitados por outra pessoa não o trancam fora.
  if (p.pacienteId && !existente.pacienteId) return existente;
  const outraConta = p.pacienteId && existente.pacienteId && existente.pacienteId !== p.pacienteId;
  const nomeDiverge = !p.pacienteId && primeiroNome(existente.nome) !== primeiroNome(p.nome);
  if (outraConta || existente.nascimento !== p.nascimento || nomeDiverge) {
    throw new ErroApi(
      409,
      "pessoa_divergente",
      undefined,
      "Esse CPF já está cadastrado com outros dados. Confira o CPF, o nome e a data de nascimento, ou procure a recepção.",
    );
  }
  return existente;
}

// RN-LE-02 / AD-035: com CPF, a mesma pessoa_local; o dono da conta fica ligado pelo `paciente_id`.
export async function pessoaAtendida(db: BancoDoTenant, p: PessoaInformada): Promise<{ id: string }> {
  const existente = await pessoaPorCpf(db, p);
  if (existente) {
    if (p.pacienteId && !existente.pacienteId) {
      await db
        .update(pessoaLocal)
        .set({ pacienteId: p.pacienteId, nome: p.nome, nascimento: p.nascimento })
        .where(eq(pessoaLocal.id, existente.id));
    }
    return { id: existente.id };
  }
  const [nova] = await db
    .insert(pessoaLocal)
    .values({ nome: p.nome, nascimento: p.nascimento, cpf: p.cpf, pacienteId: p.pacienteId })
    .returning({ id: pessoaLocal.id });
  if (!nova) throw new Error("pessoa_local não criada");
  return nova;
}

export async function inserirEntrada(db: BancoDoTenant, e: Entrada, pessoaLocalId: string): Promise<void> {
  await db.insert(entrada).values({
    id: e.id,
    servicoId: e.servicoId,
    pessoaLocalId,
    responsavelPacienteId: e.responsavelId,
    estado: e.estado,
    dataEntradaOriginal: new Date(e.dataEntradaOriginal),
    classificacao: e.classificacao,
    riscoConfirmado: e.riscoConfirmado,
    prioridade: e.prioridade,
    remanejada: e.remanejada,
    recusas: e.recusas,
    sessaoId: e.sessaoId,
    alocadaEm: data(e.alocadaEm),
    perguntadoEm: data(e.perguntadoEm),
    respondidoEm: data(e.respondidoEm),
    arquivadaEm: data(e.arquivadaEm),
    sessoesRecusadas: e.sessoesRecusadas,
  });
}

type Linha = { e: typeof entrada.$inferSelect; p: typeof pessoaLocal.$inferSelect };

function paraEntrada({ e, p }: Linha): Entrada {
  return {
    id: e.id,
    servicoId: e.servicoId,
    responsavelId: e.responsavelPacienteId,
    pessoa: { nome: p.nome, nascimento: p.nascimento, cpf: p.cpf },
    estado: e.estado,
    dataEntradaOriginal: e.dataEntradaOriginal.getTime(),
    classificacao: e.classificacao,
    riscoConfirmado: e.riscoConfirmado,
    prioridade: e.prioridade,
    remanejada: e.remanejada,
    recusas: e.recusas,
    sessaoId: e.sessaoId,
    alocadaEm: ms(e.alocadaEm),
    perguntadoEm: ms(e.perguntadoEm),
    respondidoEm: ms(e.respondidoEm),
    arquivadaEm: ms(e.arquivadaEm),
    sessoesRecusadas: e.sessoesRecusadas,
  };
}

const comPessoa = (db: BancoDoTenant) =>
  db
    .select({ e: entrada, p: pessoaLocal })
    .from(entrada)
    .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id));

export async function lerEntrada(db: BancoDoTenant, id: string): Promise<Entrada | null> {
  const [linha] = await comPessoa(db).where(eq(entrada.id, id));
  return linha ? paraEntrada(linha) : null;
}

export async function entradasAtivasDoServico(db: BancoDoTenant, servicoId: string): Promise<Entrada[]> {
  const linhas = await comPessoa(db).where(and(eq(entrada.servicoId, servicoId), notInArray(entrada.estado, FINAIS)));
  return linhas.map(paraEntrada);
}

export type CmdEntrarNaLista = {
  servicoId: string;
  pessoa: PessoaInformada;
  responsavelPacienteId: string | null;
  respostas: Respostas;
  agora: number;
};

async function entrar(tx: BancoDoTenant, cmd: CmdEntrarNaLista): Promise<Resultado<Entrada>> {
  const [linha] = await tx
    .select({ s: servico, u: unidade })
    .from(servico)
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .where(eq(servico.id, cmd.servicoId));
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  const config = { ...configEfetiva({ municipio: {}, unidade: linha.u.config }), fuso: linha.u.fuso };
  const ativas = await entradasAtivasDoServico(tx, cmd.servicoId);
  const r = criarEntrada(
    ativas,
    {
      servico: { id: linha.s.id, modo: linha.s.modo, exigeTriagem: linha.s.exigeTriagem },
      pessoa: { nome: cmd.pessoa.nome, nascimento: cmd.pessoa.nascimento, cpf: cmd.pessoa.cpf },
      responsavelId: cmd.responsavelPacienteId,
      respostas: cmd.respostas,
      id: randomUUID(),
    },
    cmd.agora,
    config,
  );
  if (!r.ok) return r;
  const { id } = await pessoaAtendida(tx, cmd.pessoa);
  await inserirEntrada(tx, r.estado, id);
  return r;
}

// RN-LE-01 / RN-LE-05: a entrada na lista que a rota do app e a do balcão chamam. Numa transação.
export async function entrarNaLista(db: DbDoTenant | TxDoTenant, cmd: CmdEntrarNaLista): Promise<Resultado<Entrada>> {
  if (db instanceof PgTransaction) return entrar(db, cmd);
  return db.transaction((tx) => entrar(tx, cmd));
}

// O que o domínio pode mudar numa entrada existente (a pessoa e a data original nunca mudam, INV-09).
export async function atualizarEntrada(db: BancoDoTenant, e: Entrada): Promise<void> {
  await db
    .update(entrada)
    .set({
      estado: e.estado,
      classificacao: e.classificacao,
      riscoConfirmado: e.riscoConfirmado,
      prioridade: e.prioridade,
      remanejada: e.remanejada,
      recusas: e.recusas,
      sessaoId: e.sessaoId,
      alocadaEm: data(e.alocadaEm),
      perguntadoEm: data(e.perguntadoEm),
      respondidoEm: data(e.respondidoEm),
      arquivadaEm: data(e.arquivadaEm),
      sessoesRecusadas: e.sessoesRecusadas,
    })
    .where(eq(entrada.id, e.id));
}

export async function entradasDaSessao(db: BancoDoTenant, sessaoId: string): Promise<Entrada[]> {
  const linhas = await comPessoa(db).where(eq(entrada.sessaoId, sessaoId));
  return linhas.map(paraEntrada);
}
