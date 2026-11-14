import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let ana: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
let outro: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
let privadaId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  ana = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Ana Paciente" }));
  outro = await orchestrator.loginPaciente();
  const agora = Date.now();
  privadaId = (
    await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/sessoes`, c.admin, {
      servicoId: c.servicoId,
      inicio: new Date(agora + 86400_000).toISOString(),
      fim: new Date(agora + 90000_000).toISOString(),
      vagas: 5,
      visibilidade: "privada",
      dispensaPreCadastro: false,
      profissional: null,
      estacoes: [c.e1],
    })
  ).corpo.id;
});
afterAll(() => orchestrator.derrubarMunicipios());

async function app(metodo: string, caminho: string, cookie?: string, corpo?: unknown) {
  const r = await fetch(`${webserver.origin}${caminho}`, {
    method: metodo,
    headers: { ...(cookie ? { cookie } : {}), ...(corpo !== undefined ? { "content-type": "application/json" } : {}) },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : undefined };
}
const m = () => `/v1/municipios/${c.slug}`;
const inscrever = (sessaoId: string, cookie: string | undefined, corpo: unknown) =>
  app("POST", `${m()}/sessoes/${sessaoId}/inscricoes`, cookie, corpo);
const eu = { paraQuem: { tipo: "eu" }, respostas: ROTINA };

describe("app do paciente na API (T3.2, T3.3, T3.4)", () => {
  it("GET /v1/municipios lista o município ativo", async () => {
    const r = await app("GET", "/v1/municipios");
    expect(r.status).toBe(200);
    expect(r.corpo.map((x: { slug: string }) => x.slug)).toContain(c.slug);
  });

  it("T3.2: a agenda traz só sessões públicas, com vagas restantes e sem dado de paciente", async () => {
    const r = await app("GET", `${m()}/agenda`);
    expect(r.status).toBe(200);
    const ids = r.corpo.map((s: { id: string }) => s.id);
    expect(ids).toContain(c.sessaoId);
    expect(ids).not.toContain(privadaId);
    expect(r.corpo[0]).toMatchObject({
      servico: { nome: "Clínico" },
      unidade: { nome: "UBS Centro" },
      vagasRestantes: 20,
    });
  });

  it("T3.3: inscrição exige conta; para mim e para outra pessoa; recusas com o código certo", async () => {
    expect((await inscrever(c.sessaoId, undefined, eu)).status).toBe(401);
    const r = await inscrever(c.sessaoId, ana.cookie, eu);
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({ estado: "confirmada", classificacao: { nivel: "rotina", apoio: false } });
    expect(await inscrever(c.sessaoId, ana.cookie, eu)).toMatchObject({ status: 409, corpo: { erro: "duplicada" } });
    const filha = await inscrever(c.sessaoId, ana.cookie, {
      paraQuem: { tipo: "outra", nome: "Bia Paciente", nascimento: "2015-02-02", cpf: null },
      respostas: ROTINA,
    });
    expect(filha.status).toBe(201);
    expect((await inscrever(privadaId, outro.cookie, eu)).corpo.erro).toBe("sessao_privada");
    const emergencia = await inscrever(c.sessaoId, outro.cookie, {
      paraQuem: { tipo: "eu" },
      respostas: { ...ROTINA, alarmes: ["dor_no_peito"] },
    });
    expect(emergencia).toMatchObject({ status: 409, corpo: { erro: "emergencia" } });
    expect(
      (await app("GET", `${m()}/agenda`)).corpo.find((s: { id: string }) => s.id === c.sessaoId).vagasRestantes,
    ).toBe(18);
  });

  it("INV-06 / T3.4: 'minhas' mostra só as do paciente, com posição e depois a chamada", async () => {
    expect((await app("GET", `${m()}/minhas`, outro.cookie)).corpo).toEqual([]);
    let r = await app("GET", `${m()}/minhas`, ana.cookie);
    expect(r.corpo.map((e: { pessoa: string }) => e.pessoa).sort()).toEqual(["Ana Paciente", "Bia Paciente"]);
    expect(r.corpo[0]).toMatchObject({ senha: null, estimativa: { tipo: "aguardando_inicio" } });
    // O app precisa saber o serviço e se a inscrição é da própria conta, para não oferecer de novo (AD-032).
    const daAna = r.corpo.find((e: { pessoa: string }) => e.pessoa === "Ana Paciente");
    const daBia = r.corpo.find((e: { pessoa: string }) => e.pessoa === "Bia Paciente");
    expect(daAna).toMatchObject({ servicoId: c.servicoId, paraMim: true });
    expect(daBia).toMatchObject({ servicoId: c.servicoId, paraMim: false });

    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    r = await app("GET", `${m()}/minhas`, ana.cookie);
    const minha = r.corpo.find((e: { pessoa: string }) => e.pessoa === "Ana Paciente");
    expect(minha).toMatchObject({ senha: "C-001", itemEstado: "remoto", estimativa: { tipo: "venha_agora" } });

    const recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
      entradaId: minha.entradaId,
      resultado: "confere",
    });
    await c.pedir("POST", `/v1/painel/estacoes/${c.e1}/chamar`, c.enfermeiro, {});
    r = await app("GET", `${m()}/minhas`, ana.cookie);
    expect(r.corpo.find((e: { pessoa: string }) => e.pessoa === "Ana Paciente")).toMatchObject({
      itemEstado: "chamado",
      estimativa: { tipo: "chamado" },
      chamada: { estacao: "Sala 1" },
    });
  });
});
