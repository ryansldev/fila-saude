import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let ana: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
let outro: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
let reguladoId: string;
let requisicaoId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  ana = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Ana Lista" }));
  outro = await orchestrator.loginPaciente();
  const servico = async (nome: string, prefixo: string, modo: string) =>
    (
      await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/servicos`, c.admin, {
        nome,
        prefixo,
        exigeTriagem: false,
        modo,
        tempoMedioMin: {},
      })
    ).corpo.id as string;
  reguladoId = await servico("Cardiologia", "K", "regulado");
  requisicaoId = await servico("Raio-X", "R", "requisicao");
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
const entrar = (servicoId: string, cookie: string | undefined, corpo: unknown) =>
  app("POST", `${m()}/servicos/${servicoId}/entradas`, cookie, corpo);
const eu = { paraQuem: { tipo: "eu" }, respostas: ROTINA };

describe("lista de espera pelo app (T5.1)", () => {
  it("I1: serviços da unidade com o modo de marcação, sem dado de paciente", async () => {
    const r = await app("GET", `${m()}/unidades/${c.unidadeId}/servicos`);
    expect(r.status).toBe(200);
    const porNome = Object.fromEntries(r.corpo.map((s: { nome: string; modo: string }) => [s.nome, s.modo]));
    expect(porNome).toEqual({ Cardiologia: "regulado", Clínico: "livre", "Raio-X": "requisicao" });
  });

  it("RN-LE-01/02/05: entra na lista para si e para outra pessoa; duplicada mostra a existente", async () => {
    expect((await entrar(c.servicoId, undefined, eu)).status).toBe(401);
    const r = await entrar(c.servicoId, ana.cookie, eu);
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({ estado: "aguardando", classificacao: { nivel: "rotina" } });

    const dup = await entrar(c.servicoId, ana.cookie, eu);
    expect(dup).toMatchObject({ status: 409, corpo: { erro: "duplicada", dados: { entradaId: r.corpo.entradaId } } });

    const filho = await entrar(c.servicoId, ana.cookie, {
      paraQuem: {
        tipo: "outra",
        relacao: "responsavel_legal",
        declarou: true,
        nome: "Caio Lista",
        nascimento: "2018-03-03",
        cpf: null,
      },
      respostas: ROTINA,
    });
    expect(filho.status).toBe(201);
    const semRelacao = await entrar(c.servicoId, ana.cookie, {
      paraQuem: { tipo: "outra", nome: "Duda Lista", nascimento: "2019-05-05", cpf: null },
      respostas: ROTINA,
    });
    expect(semRelacao.status).toBe(400);

    const minhas = (await app("GET", `${m()}/minhas`, ana.cookie)).corpo;
    expect(
      minhas.map((e: { pessoa: string; estado: string; sessao: unknown }) => [e.pessoa, e.estado, e.sessao]),
    ).toEqual([
      ["Ana Lista", "aguardando", null],
      ["Caio Lista", "aguardando", null],
    ]);
  });

  it("duplicada de outra conta não revela a entrada", async () => {
    const caio = {
      paraQuem: {
        tipo: "outra",
        relacao: "responsavel_legal",
        declarou: true,
        nome: "Caio Lista",
        nascimento: "2018-03-03",
        cpf: null,
      },
      respostas: ROTINA,
    };
    const dup = await entrar(c.servicoId, outro.cookie, caio);
    expect(dup.status).toBe(409);
    expect(dup.corpo.erro).toBe("duplicada");
    expect(dup.corpo.dados).toBeUndefined();
  });

  it("RN-ENC-05 e I2: regulado e requisição recusados; emergência não cria", async () => {
    expect((await entrar(reguladoId, outro.cookie, eu)).corpo.erro).toBe("servico_regulado");
    expect((await entrar(requisicaoId, outro.cookie, eu)).corpo.erro).toBe("requisicao_em_breve");
    const emergencia = await entrar(c.servicoId, outro.cookie, {
      paraQuem: { tipo: "eu" },
      respostas: { ...ROTINA, alarmes: ["dor_no_peito"] },
    });
    expect(emergencia).toMatchObject({ status: 409, corpo: { erro: "emergencia" } });
  });

  it("RN-RISCO-03 / I9: refaz o questionário na lista; só a conta responsável", async () => {
    const id = (await app("GET", `${m()}/minhas`, ana.cookie)).corpo.find(
      (e: { pessoa: string }) => e.pessoa === "Ana Lista",
    ).entradaId;
    const forte = { ...ROTINA, motivo: "novo", gravidade: "forte" };
    expect((await app("POST", `${m()}/entradas/${id}/questionario`, outro.cookie, { respostas: forte })).status).toBe(
      404,
    );
    const r = await app("POST", `${m()}/entradas/${id}/questionario`, ana.cookie, { respostas: forte });
    expect(r).toMatchObject({ status: 200, corpo: { classificacao: { nivel: "urgente" } } });
    const emergencia = await app("POST", `${m()}/entradas/${id}/questionario`, ana.cookie, {
      respostas: { ...ROTINA, alarmes: ["desmaio"] },
    });
    expect(emergencia).toMatchObject({ status: 409, corpo: { erro: "emergencia" } });
  });

  it("cancelar a entrada da lista libera o serviço para entrar de novo", async () => {
    const id = (await app("GET", `${m()}/minhas`, ana.cookie)).corpo.find(
      (e: { pessoa: string }) => e.pessoa === "Caio Lista",
    ).entradaId;
    expect((await app("POST", `${m()}/entradas/${id}/cancelar`, ana.cookie)).status).toBe(200);
    const caio = {
      paraQuem: {
        tipo: "outra",
        relacao: "responsavel_legal",
        declarou: true,
        nome: "Caio Lista",
        nascimento: "2018-03-03",
        cpf: null,
      },
      respostas: ROTINA,
    };
    expect((await entrar(c.servicoId, ana.cookie, caio)).status).toBe(201);
  });
});
