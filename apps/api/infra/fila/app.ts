import { cancelarEntrada, estimar, preencherDaReserva, vouSair } from "@fila-saude/domain";
import type { InscricaoEntrada, MinhaEntrada, SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { and, asc, eq, gt, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import type { PacienteAutenticado } from "infra/auth/sessao-paciente";
import { exigirServico } from "infra/config/servicos";
import database from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { municipio } from "infra/database/central/schema/municipio";
import { entrada } from "infra/database/municipal/schema/entrada";
import { estacao } from "infra/database/municipal/schema/estacao";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { DbDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { lerDia, naSessao, paraServico } from "./dia";
import { atualizarEntrada, lerEntrada } from "./entradas";
import { inscrever } from "./inscricao";

const FINAIS = ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"] as const;
const DIAS_DA_AGENDA = 14;
const MAX_POR_CONTA = 5;

export async function municipiosAtivos() {
  return database
    .select({ slug: municipio.slug, nome: municipio.nome, uf: municipio.uf })
    .from(municipio)
    .where(eq(municipio.status, "ativo"))
    .orderBy(asc(municipio.nome));
}

// T3.2 / RN-AG-01: sessões públicas de agora até 14 dias, com vagas restantes; nada de paciente.
export async function agenda(db: DbDoTenant, agora: number): Promise<SessaoDaAgenda[]> {
  const linhas = await db
    .select({ s: sessao, srv: servico, u: unidade })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .where(
      and(
        eq(sessao.visibilidade, "publica"),
        inArray(sessao.estado, ["planejada", "aberta"]),
        gt(sessao.fim, new Date(agora)),
        lt(sessao.inicio, new Date(agora + DIAS_DA_AGENDA * 86400_000)),
        eq(servico.ativo, true),
        isNull(unidade.arquivadaEm),
      ),
    )
    .orderBy(asc(sessao.inicio));
  return linhas.map(({ s, srv, u }) => ({
    id: s.id,
    unidade: { id: u.id, nome: u.nome, bairro: u.bairro },
    servico: { id: srv.id, nome: srv.nome },
    inicio: s.inicio.toISOString(),
    fim: s.fim.toISOString(),
    profissional: s.profissional,
    vagasRestantes: s.vagas === null ? null : Math.max(0, s.vagas - s.ocupadas),
    estado: s.estado as "planejada" | "aberta",
  }));
}

// T3.3 / AD-018: "para mim" usa os dados da conta; "outra pessoa" fica com a conta como responsável.
export async function inscreverPaciente(
  db: DbDoTenant,
  p: PacienteAutenticado,
  sessaoId: string,
  dados: InscricaoEntrada,
  agora: number,
) {
  const [s] = await db.select({ visibilidade: sessao.visibilidade }).from(sessao).where(eq(sessao.id, sessaoId));
  if (!s) throw new ErroApi(404, "nao_encontrado");
  if (s.visibilidade !== "publica") throw new ErroApi(409, "sessao_privada");
  // RN-ID-07 (enxuto): uma conta não lota a sessão com pessoas inventadas.
  const ativas = await db
    .select({ id: entrada.id })
    .from(entrada)
    .where(
      and(
        eq(entrada.sessaoId, sessaoId),
        eq(entrada.responsavelPacienteId, p.pacienteId),
        notInArray(entrada.estado, [...FINAIS]),
      ),
    );
  if (ativas.length >= MAX_POR_CONTA)
    throw new ErroApi(
      409,
      "limite_por_conta",
      undefined,
      `Uma conta inscreve até ${MAX_POR_CONTA} pessoas por atendimento. Para mais, procure a recepção.`,
    );
  let pessoa: { nome: string; nascimento: string; cpf: string | null; pacienteId: string | null };
  if (dados.paraQuem.tipo === "eu") {
    const [conta] = await database
      .select({ nome: paciente.name, nascimento: paciente.nascimento, cpf: paciente.cpf })
      .from(paciente)
      .where(eq(paciente.id, p.pacienteId));
    if (!conta) throw new ErroApi(401, "nao_autenticado");
    pessoa = { ...conta, pacienteId: p.pacienteId };
  } else {
    const { nome, nascimento, cpf } = dados.paraQuem;
    pessoa = { nome, nascimento, cpf: cpf ? cpf.replace(/\D/g, "") : null, pacienteId: null };
  }
  const e = await inscrever(db, sessaoId, {
    pessoa,
    responsavelPacienteId: p.pacienteId,
    respostas: dados.respostas,
    agora,
  });
  return {
    entradaId: e.id,
    estado: e.estado,
    classificacao: { nivel: e.classificacao.nivel, apoio: e.classificacao.apoio },
  };
}

// T3.4 / INV-06: só as entradas de que a conta é responsável; as finais ficam 12 h para o app mostrar o fim.
export async function minhas(db: DbDoTenant, pacienteId: string, agora: number): Promise<MinhaEntrada[]> {
  const linhas = await db
    .select({ e: entrada, p: pessoaLocal, s: sessao, srv: servico, u: unidade })
    .from(entrada)
    .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id))
    .innerJoin(servico, eq(entrada.servicoId, servico.id))
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .leftJoin(sessao, eq(entrada.sessaoId, sessao.id))
    .where(
      and(
        eq(entrada.responsavelPacienteId, pacienteId),
        or(notInArray(entrada.estado, [...FINAIS]), gt(sessao.fim, new Date(agora - 12 * 3600_000))),
      ),
    )
    .orderBy(asc(entrada.criadoEm));
  const nomesDeEstacao = new Map(
    (await db.select({ id: estacao.id, nome: estacao.nome }).from(estacao)).map((x) => [x.id, x.nome]),
  );
  const saida: MinhaEntrada[] = [];
  for (const { e, p, s, srv, u } of linhas) {
    const dia = s ? await lerDia(db, s.id) : null;
    const item = dia?.itens.find((i) => i.entradaId === e.id) ?? null;
    const ultima = item ? dia?.chamadas.findLast((c) => c.itemId === item.id) : undefined;
    saida.push({
      entradaId: e.id,
      pessoa: p.nome,
      estado: e.estado,
      servico: srv.nome,
      unidade: u.nome,
      sessao: s ? { id: s.id, inicio: s.inicio.toISOString(), fim: s.fim.toISOString(), estado: s.estado } : null,
      senha: item?.senha ?? null,
      itemEstado: item?.estado ?? null,
      estimativa:
        dia && item
          ? estimar(dia, item.id, agora, { modoManual: false })
          : s?.estado === "planejada"
            ? { tipo: "aguardando_inicio" }
            : null,
      chamada:
        item?.estado === "chamado" && ultima
          ? { estacao: nomesDeEstacao.get(ultima.estacaoId) ?? "", em: new Date(ultima.em).toISOString() }
          : null,
      pendencias: item?.estado === "remoto" ? item.pendencias : [],
      servicoId: srv.id,
      paraMim: p.pacienteId === pacienteId,
      saiaDeCasa:
        item?.estado === "remoto" &&
        Boolean(dia?.avisosSaiaDeCasa.some((a) => a.itemId === item.id && a.etapa === item.etapa)),
    });
  }
  return saida;
}

// RN-PRES-02: "Vou sair" da conta responsável; presente volta a remoto com o mesmo número.
export async function vouSairDoPaciente(db: DbDoTenant, pacienteId: string, entradaId: string, agora: number) {
  const [e] = await db
    .select({ sessaoId: entrada.sessaoId })
    .from(entrada)
    .where(and(eq(entrada.id, entradaId), eq(entrada.responsavelPacienteId, pacienteId)));
  if (!e?.sessaoId) throw new ErroApi(404, "nao_encontrado");
  return naSessao(db, e.sessaoId, async (c) => {
    const item = c.dia?.itens.find((i) => i.entradaId === entradaId);
    if (!c.dia || !item) throw new ErroApi(409, "transicao_proibida");
    const r = vouSair(c.dia, { itemId: item.id }, agora);
    if (!r.ok) throw new ErroApi(409, r.erro);
    return { dia: r.estado, eventos: r.eventos, resultado: { senha: item.senha, itemEstado: "remoto" as const } };
  });
}

const COM_VAGA = ["alocada", "confirmada", "na_fila"];

// RN-CANC-01..03: "Não vou poder ir", antes ou no dia, só pela conta responsável. Quem tinha vaga a
// libera (e o primeiro da reserva entra, RN-PUB-02); quem cancela perde o lugar.
export async function cancelarDoPaciente(db: DbDoTenant, pacienteId: string, entradaId: string, agora: number) {
  const [linha] = await db
    .select({ sessaoId: entrada.sessaoId, estado: entrada.estado })
    .from(entrada)
    .where(and(eq(entrada.id, entradaId), eq(entrada.responsavelPacienteId, pacienteId)));
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  if (!linha.sessaoId) {
    // Na lista de espera, sem sessão: só cancela.
    return db.transaction(async (tx) => {
      const e = await lerEntrada(tx, entradaId);
      if (!e) throw new ErroApi(404, "nao_encontrado");
      const r = cancelarEntrada(e, null, null, { servico: paraServico(await exigirServico(tx, e.servicoId)) }, agora);
      if (!r.ok) throw new ErroApi(409, r.erro);
      await atualizarEntrada(tx, r.estado.entrada);
      return { estado: "cancelada" as const };
    });
  }
  return naSessao(db, linha.sessaoId, async (c) => {
    const e = c.entradas.find((x) => x.id === entradaId);
    if (!e) throw new ErroApi(409, "transicao_proibida");
    const comVaga = COM_VAGA.includes(e.estado);
    const r = cancelarEntrada(e, comVaga ? c.sessao : null, c.dia, { servico: c.servico }, agora);
    if (!r.ok) throw new ErroApi(409, r.erro);
    const sessaoDepois = r.estado.sessao ?? c.sessao;
    const entradas = c.entradas.map((x) => (x.id === entradaId ? r.estado.entrada : x));
    const reserva = preencherDaReserva(
      sessaoDepois,
      r.estado.dia,
      entradas,
      { servico: c.servico, fotosAceitas: [] },
      agora,
    );
    const final = reserva.ok
      ? { dia: reserva.estado.dia, sessao: reserva.estado.sessao, entradas: reserva.estado.entradas }
      : { dia: r.estado.dia, sessao: sessaoDepois, entradas };
    return { ...final, eventos: r.eventos, resultado: { estado: "cancelada" as const } };
  });
}
