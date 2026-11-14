import { type Acao, checkIn, type Pendencia, tokenQr, validarQr } from "@fila-saude/domain";
import type { CheckIn, QrDaUnidade } from "@fila-saude/schemas/fila";
import { and, eq, inArray } from "drizzle-orm";
import type { PacienteAutenticado } from "infra/auth/sessao-paciente";
import { exigirUnidade } from "infra/config/comum";
import { diaSessao } from "infra/database/municipal/schema/dia-sessao";
import { entrada } from "infra/database/municipal/schema/entrada";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant, DbDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import type { ContextoDaAcao } from "infra/painel/acao";
import { condicoesNaUnidade } from "infra/painel/guard";
import { naSessao } from "./dia";

// Quem cuida da tela do QR na recepção (até a TV pareada da fatia 2).
const ACOES_DO_QR: Acao[] = ["conferir_e_marcar_presenca", "abrir_cancelar_encerrar_sessao"];

async function abertasDaUnidade(db: BancoDoTenant, unidadeId: string) {
  return db
    .select({ id: sessao.id, servico: servico.nome, segredo: diaSessao.segredoQr, dia: diaSessao.dia })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .innerJoin(diaSessao, eq(diaSessao.sessaoId, sessao.id))
    .where(and(eq(servico.unidadeId, unidadeId), eq(sessao.estado, "aberta")));
}

const intervaloDe = (abertas: Awaited<ReturnType<typeof abertasDaUnidade>>) =>
  (abertas[0]?.dia.config.qrSegundos ?? 30) * 1000;

// RN-PRES-01: um link com o token de cada sessão aberta; o app abre direto pela câmera do celular.
// Sem checar quem pede: a tela do QR no painel e a TV pareada (RN-TV-02) checam antes.
export async function conteudoDoQr(
  db: BancoDoTenant,
  slug: string,
  unidadeId: string,
  agora: number,
): Promise<QrDaUnidade> {
  const abertas = (await abertasDaUnidade(db, unidadeId)).filter((s) => s.segredo !== null);
  const intervalo = intervaloDe(abertas);
  if (abertas.length === 0) return { conteudo: null, intervaloSegundos: intervalo / 1000, expiraEm: null, sessoes: [] };
  const tokens = await Promise.all(abertas.map((s) => tokenQr(s.segredo as string, agora, intervalo)));
  const url = new URL("filasaude://check-in");
  url.searchParams.set("m", slug);
  url.searchParams.set("u", unidadeId);
  url.searchParams.set("t", tokens.join(","));
  return {
    conteudo: url.toString(),
    intervaloSegundos: intervalo / 1000,
    expiraEm: new Date((Math.floor(agora / intervalo) + 1) * intervalo).toISOString(),
    sessoes: abertas.map((s) => ({ id: s.id, servico: s.servico })),
  };
}

export async function qrDaUnidade(ctx: ContextoDaAcao, slug: string, unidadeId: string): Promise<QrDaUnidade> {
  await exigirUnidade(ctx.db, unidadeId);
  if (!ACOES_DO_QR.some((a) => condicoesNaUnidade(ctx.ator.perfis, a, unidadeId) !== null)) {
    throw new ErroApi(403, "sem_permissao");
  }
  return conteudoDoQr(ctx.db, slug, unidadeId, ctx.agora);
}

// RN-PRES-01 + RN-FILA-05: o paciente leu o QR; cada pessoa da conta nas sessões do QR entra presente,
// ou fica remota com as pendências que só a recepção resolve.
export async function checkInDoPaciente(
  db: DbDoTenant,
  p: PacienteAutenticado,
  unidadeId: string,
  tokens: string[],
  agora: number,
): Promise<CheckIn> {
  const abertas = (await abertasDaUnidade(db, unidadeId)).filter((s) => s.segredo !== null);
  const intervalo = intervaloDe(abertas);
  const validas: string[] = [];
  for (const s of abertas) {
    for (const t of tokens) {
      if ((await validarQr([s.segredo as string], t, agora, intervalo)) !== null) {
        validas.push(s.id);
        break;
      }
    }
  }
  if (validas.length === 0)
    throw new ErroApi(409, "qr_invalido", undefined, "QR vencido. Leia de novo o QR da unidade.");

  const pessoas = await db
    .select({
      id: entrada.id,
      nome: pessoaLocal.nome,
      pacienteId: pessoaLocal.pacienteId,
      conferida: pessoaLocal.documentoConferidoEm,
    })
    .from(entrada)
    .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id))
    .where(and(eq(entrada.responsavelPacienteId, p.pacienteId), inArray(entrada.sessaoId, validas)));
  const saida: CheckIn = [];
  for (const sessaoId of validas) {
    await naSessao(db, sessaoId, async (c) => {
      if (!c.dia) return { resultado: null };
      let dia = c.dia;
      for (const pessoa of pessoas) {
        const item = dia.itens.find((i) => i.entradaId === pessoa.id);
        if (!item) continue;
        const base = { entradaId: pessoa.id, pessoa: pessoa.nome, senha: item.senha };
        if (item.estado !== "remoto") {
          if (item.estado === "presente") saida.push({ ...base, resultado: "ja_na_unidade", pendencias: [] });
          continue;
        }
        const dono = pessoa.pacienteId === p.pacienteId;
        const pendencias: Pendencia[] = [];
        if (dono && !p.verificado) pendencias.push("conta");
        if (!dono && pessoa.conferida === null) pendencias.push("pessoa_atendida");
        const comPendencias = { ...dia, itens: dia.itens.map((i) => (i.id === item.id ? { ...i, pendencias } : i)) };
        const r = checkIn(comPendencias, { itemId: item.id }, agora);
        if (r.ok) {
          dia = r.estado;
          saida.push({ ...base, resultado: "presente", pendencias: [] });
        } else if (r.erro === "pendencia") {
          dia = comPendencias;
          const efetivas = [...pendencias];
          if (efetivas.length === 0) efetivas.push("prioridade");
          saida.push({ ...base, resultado: "pendencia", pendencias: efetivas });
        }
        // Outro motivo (ex.: chamado agora): essa pessoa fica como está e as demais seguem; um erro
        // aqui desfaria a resposta das sessões já gravadas.
      }
      return { dia, resultado: null };
    });
  }
  return saida;
}
