import type { Respostas } from "@fila-saude/domain";
import { inscrever } from "infra/fila/inscricao";
import orchestrator from "tests/orchestrator";
import { gerente, municipioComUnidade, ocupacao, usuarioLogado } from "tests/painel";

export const ROTINA: Respostas = { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] };

// Município com unidade, admin, enfermeiro, um serviço, duas estações de atendimento e uma sessão pública de hoje.
export async function cenarioDaFila(opcoes: { vagas?: number } = {}) {
  const { slug, gestor, unidadeId } = await municipioComUnidade();
  const admin = (await usuarioLogado(slug, gestor, "admin", gerente(unidadeId))).cookie;
  const enfermeiro = (await usuarioLogado(slug, gestor, "enfermeira", ocupacao(unidadeId, "enfermeiro"))).cookie;
  const pedir = (m: string, c: string, cookie: string, corpo?: unknown) =>
    orchestrator.pedirPainel(slug, m, c, { cookie, ...(corpo !== undefined ? { corpo } : {}) });
  const servicoId = (
    await pedir("POST", `/v1/painel/unidades/${unidadeId}/servicos`, admin, {
      nome: "Clínico",
      prefixo: "C",
      exigeTriagem: false,
      modo: "livre",
      tempoMedioMin: {},
    })
  ).corpo.id as string;
  const estacao = async (nome: string) =>
    (
      await pedir("POST", `/v1/painel/unidades/${unidadeId}/estacoes`, admin, {
        nome,
        etapa: "atendimento",
        servicos: [servicoId],
      })
    ).corpo.id as string;
  const e1 = await estacao("Sala 1");
  const e2 = await estacao("Sala 2");
  const agora = Date.now();
  const s = await pedir("POST", `/v1/painel/unidades/${unidadeId}/sessoes`, admin, {
    servicoId,
    // Começou há 1 min: "hoje" no fuso da unidade a qualquer hora (1 h antes falhava depois da meia-noite).
    inicio: new Date(agora - 60_000).toISOString(),
    fim: new Date(agora + 3 * 3600_000).toISOString(),
    vagas: opcoes.vagas ?? 20,
    visibilidade: "publica",
    dispensaPreCadastro: false,
    profissional: null,
    estacoes: [e1, e2],
  });
  if (s.status !== 201) throw new Error(`sessão: ${s.status} ${JSON.stringify(s.corpo)}`);
  return { slug, gestor, unidadeId, admin, enfermeiro, servicoId, e1, e2, sessaoId: s.corpo.id as string, pedir };
}

// Inscrição de uma pessoa sem conta pela mesma função da rota do app.
export async function inscreverPessoa(slug: string, sessaoId: string, nome: string, respostas = ROTINA) {
  return inscrever(orchestrator.bancoDoMunicipio(slug), sessaoId, {
    pessoa: { nome, nascimento: "1990-05-05", cpf: orchestrator.gerarCpf(), pacienteId: null },
    responsavelPacienteId: null,
    respostas,
    agora: Date.now(),
  });
}
