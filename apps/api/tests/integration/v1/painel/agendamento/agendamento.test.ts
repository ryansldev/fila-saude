import { entrarNaLista } from "infra/fila/entradas";
import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let agenda: string;
let agenda2: string;
let privadaId: string;
let ana: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
const ids: Record<string, string> = {};

const DIA = 86400_000;
const FORTE = { ...ROTINA, motivo: "novo" as const, gravidade: "forte" as const };
const AUTOLESAO = { ...ROTINA, alarmes: ["autolesao" as const] };

async function semConta(nome: string, respostas = ROTINA, nascimento = "1990-05-05") {
  const r = await entrarNaLista(orchestrator.bancoDoMunicipio(c.slug), {
    servicoId: c.servicoId,
    pessoa: { nome, nascimento, cpf: orchestrator.gerarCpf(), pacienteId: null },
    responsavelPacienteId: null,
    respostas,
    agora: Date.now() - 10 * DIA,
  });
  if (!r.ok) throw new Error(r.erro);
  return r.estado.id;
}

async function privada(vagas: number, emDias = 2) {
  const inicio = Date.now() + emDias * DIA;
  const r = await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/sessoes`, c.admin, {
    servicoId: c.servicoId,
    inicio: new Date(inicio).toISOString(),
    fim: new Date(inicio + 4 * 3600_000).toISOString(),
    vagas,
    visibilidade: "privada",
    dispensaPreCadastro: false,
    profissional: null,
    estacoes: [c.e1],
  });
  return r.corpo.id as string;
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  agenda = (await usuarioLogado(c.slug, c.gestor, "agenda", ocupacao(c.unidadeId, "recepcao", "agendar"))).cookie;
  agenda2 = (await usuarioLogado(c.slug, c.gestor, "agenda2", ocupacao(c.unidadeId, "recepcao", "agendar"))).cookie;
  privadaId = await privada(3);
  ids.rotina = await semConta("Rosa Rotina");
  ids.urgente = await semConta("Ulisses Urgente", FORTE);
  ids.apoio = await semConta("Aline Apoio", AUTOLESAO);
  ana = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Ana Agenda" }));
  const r = await fetch(`${webserver.origin}/v1/municipios/${c.slug}/servicos/${c.servicoId}/entradas`, {
    method: "POST",
    headers: { cookie: ana.cookie, "content-type": "application/json" },
    body: JSON.stringify({ paraQuem: { tipo: "eu" }, respostas: ROTINA }),
  });
  ids.ana = ((await r.json()) as { entradaId: string }).entradaId;
});
afterAll(() => orchestrator.derrubarMunicipios());

const alocacao = (cookie: string, sessaoId = privadaId) =>
  c.pedir("GET", `/v1/painel/sessoes/${sessaoId}/alocacao`, cookie);
const alocar = (cookie: string, entradaId: string, sessaoId = privadaId) =>
  c.pedir("POST", `/v1/painel/sessoes/${sessaoId}/alocar`, cookie, { entradaId });
const responder = (cookie: string, entradaId: string, resposta: string) =>
  c.pedir("POST", `/v1/painel/entradas/${entradaId}/resposta`, cookie, { resposta });

describe("agendador (T5.3, T5.4)", () => {
  it("RN-PERF-02: só quem agenda vê a alocação", async () => {
    expect((await alocacao(c.enfermeiro)).status).toBe(403);
    expect((await alocacao(agenda)).status).toBe(200);
  });

  it("RN-AL-01/02/03, I4: sugestão com motivos, urgente no topo com alerta, autolesão e faltas", async () => {
    const r = await alocacao(agenda);
    expect(r.corpo.sessao).toMatchObject({ id: privadaId, vagas: 3, ocupadas: 0, podeAlocar: true });
    expect(r.corpo.alocados).toEqual([]);
    const nomes = r.corpo.sugestao.map((s: { nome: string }) => s.nome);
    expect(nomes.slice(0, 2).sort()).toEqual(["Aline Apoio", "Ulisses Urgente"]);
    const urgente = r.corpo.sugestao.find((s: { nome: string }) => s.nome === "Ulisses Urgente");
    expect(urgente).toMatchObject({
      alerta: true,
      autolesao: false,
      faltas: 0,
      alertaFaltas: false,
      risco: { nivel: "urgente", confirmado: false, regra: "Problema novo forte" },
    });
    expect(urgente.motivos[0]).toBe("urgente sugerido");
    expect(urgente.motivos.at(-1)).toMatch(/^espera há \d+ dias$/);
    expect(r.corpo.sugestao.find((s: { nome: string }) => s.nome === "Aline Apoio").autolesao).toBe(true);
  });

  it("RN-AL-04/06: alocar ocupa a vaga, tira da sugestão e põe nos alocados com o prazo", async () => {
    const r = await alocar(agenda, ids.urgente as string);
    expect(r.status).toBe(200);
    expect(r.corpo.sessao.ocupadas).toBe(1);
    expect(r.corpo.alocados).toEqual([
      expect.objectContaining({ entradaId: ids.urgente, nome: "Ulisses Urgente", estado: "alocada", destacada: false }),
    ]);
    expect(r.corpo.alocados[0].prazo).toEqual(expect.any(String));
    expect(r.corpo.sugestao.map((s: { entradaId: string }) => s.entradaId)).not.toContain(ids.urgente);
  });

  it("INV-08 / I7: dois agendadores na última vaga; o segundo recebe 409 com a lista atualizada", async () => {
    await alocar(agenda, ids.apoio as string);
    const [a, b] = await Promise.all([alocar(agenda, ids.rotina as string), alocar(agenda2, ids.ana as string)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const perdeu = a.status === 409 ? a : b;
    expect(perdeu.corpo).toMatchObject({ erro: "sem_vaga", dados: { alocacao: { sessao: { ocupadas: 3 } } } });
  });

  it("INV-08 / I7: a mesma entrada em duas sessões ao mesmo tempo; só uma aloca", async () => {
    const s1 = await privada(5, 3);
    const s2 = await privada(5, 4);
    const id = await semConta("Dora Disputa");
    const [a, b] = await Promise.all([alocar(agenda, id, s1), alocar(agenda2, id, s2)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const perdeu = a.status === 409 ? a : b;
    expect(perdeu.corpo.erro).toBe("transicao_proibida");
  });

  it("RN-CONF-02/03, I6: lista de ligação com telefone; sem contato anota a tentativa e segue pendente", async () => {
    const alocada = (await alocacao(agenda)).corpo.alocados.find(
      (x: { nome: string }) => x.nome === "Ana Agenda" || x.nome === "Rosa Rotina",
    );
    const r1 = await responder(agenda, alocada.entradaId, "sem_contato");
    expect(r1).toMatchObject({ status: 200, corpo: { estado: "alocada" } });
    const lig = await c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/ligacao`, agenda);
    expect(lig.status).toBe(200);
    const item = lig.corpo.find((x: { entradaId: string }) => x.entradaId === alocada.entradaId);
    expect(item).toMatchObject({
      nome: alocada.nome,
      servico: "Clínico",
      sessao: { id: privadaId },
      destacada: false,
      ultimaTentativa: expect.any(String),
    });
    if (alocada.nome === "Ana Agenda") expect(item.telefone).toEqual(expect.any(String));
    expect((await c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/ligacao`, c.enfermeiro)).status).toBe(403);
  });

  it("RN-CONF-02/04: confirmou fica confirmada; recusou libera a vaga e não é sugerida de novo nesta sessão", async () => {
    const antes = (await alocacao(agenda)).corpo;
    expect((await responder(agenda, ids.urgente as string, "confirmou")).corpo.estado).toBe("confirmada");
    const r = await responder(agenda, ids.apoio as string, "recusou");
    expect(r.corpo.estado).toBe("aguardando");
    const depois = (await alocacao(agenda)).corpo;
    expect(depois.sessao.ocupadas).toBe(antes.sessao.ocupadas - 1);
    expect(depois.sugestao.map((s: { entradaId: string }) => s.entradaId)).not.toContain(ids.apoio);
    expect(depois.alocados.find((x: { entradaId: string }) => x.entradaId === ids.urgente).estado).toBe("confirmada");
    expect((await responder(agenda, ids.apoio as string, "confirmou")).status).toBe(409);
  });

  it("lista de espera da unidade: por serviço, com as sessões privadas futuras e os alertas", async () => {
    const r = await c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/lista-espera`, agenda);
    expect(r.status).toBe(200);
    const clinico = r.corpo.find((s: { servico: { id: string } }) => s.servico.id === c.servicoId);
    expect(clinico.sessoes.map((s: { id: string }) => s.id)).toContain(privadaId);
    expect(clinico.sessoes.find((s: { id: string }) => s.id === privadaId)).toMatchObject({ vagas: 3, ocupadas: 2 });
    expect(clinico.aguardando).toBeGreaterThanOrEqual(1);
    expect(clinico.alertas).toBe(1); // Aline voltou à lista; urgente sugerida não alocada
  });
});
