import { tokenQr } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import database from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { diaSessao } from "infra/database/municipal/schema/dia-sessao";
import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let recepcao: string;
let ana: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
let bruno: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;

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
const inscrever = (cookie: string, paraQuem: unknown = { tipo: "eu" }) =>
  app("POST", `${m()}/sessoes/${c.sessaoId}/inscricoes`, cookie, { paraQuem, respostas: ROTINA });
const qr = (cookie = recepcao) => c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/qr`, cookie);
const tokensDe = (conteudo: string) => (new URL(conteudo).searchParams.get("t") ?? "").split(",");
const c_fila = async () => (await c.pedir("GET", `/v1/painel/sessoes/${c.sessaoId}/fila`, recepcao)).corpo;
const checkIn = (cookie: string | undefined, tokens: string[]) =>
  app("POST", `${m()}/check-in`, cookie, { unidadeId: c.unidadeId, tokens });

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
  ana = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Ana Lima" }));
  bruno = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Bruno Reis" }));
  // Bruno já teve a conta verificada numa ida anterior (RN-ID-05).
  await database.update(paciente).set({ verificadoEm: new Date() }).where(eq(paciente.id, bruno.pacienteId));
  await inscrever(ana.cookie);
  await inscrever(bruno.cookie);
  await inscrever(bruno.cookie, { tipo: "outra", nome: "Bia Reis", nascimento: "2018-03-03", cpf: null });
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("QR de entrada (RN-PRES-01, RN-FILA-05)", () => {
  it("sem sessão aberta não há QR; só quem tem a ação na unidade vê o QR", async () => {
    expect((await qr()).corpo).toMatchObject({ conteudo: null, sessoes: [] });
    expect((await qr(c.gestor)).status).toBe(403);
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    const r = await qr();
    expect(r.status).toBe(200);
    const url = new URL(r.corpo.conteudo);
    expect(url.protocol).toBe("filasaude:");
    expect(url.searchParams.get("m")).toBe(c.slug);
    expect(url.searchParams.get("u")).toBe(c.unidadeId);
    expect(r.corpo).toMatchObject({ intervaloSegundos: 30, sessoes: [{ servico: "Clínico" }] });
  });

  it("RNF-SEG-01: sem conta → 401; token inventado ou de duas janelas atrás → qr_invalido", async () => {
    const tokens = tokensDe((await qr()).corpo.conteudo);
    expect((await checkIn(undefined, tokens)).status).toBe(401);
    expect(await checkIn(bruno.cookie, ["lixo"])).toMatchObject({ status: 409, corpo: { erro: "qr_invalido" } });
    const [linha] = await orchestrator
      .bancoDoMunicipio(c.slug)
      .select({ segredo: diaSessao.segredoQr })
      .from(diaSessao)
      .where(eq(diaSessao.sessaoId, c.sessaoId));
    const velho = await tokenQr(linha?.segredo as string, Date.now() - 60_000);
    expect((await checkIn(bruno.cookie, [velho])).corpo.erro).toBe("qr_invalido");
  });

  it("RN-PRES-01 / AD-055: uma leitura vale para a conta; verificada entra presente, a pessoa atendida não conferida fica pendente", async () => {
    const r = await checkIn(bruno.cookie, tokensDe((await qr()).corpo.conteudo));
    expect(r.status).toBe(200);
    expect(r.corpo.map((x: { pessoa: string; resultado: string }) => [x.pessoa, x.resultado]).sort()).toEqual([
      ["Bia Reis", "pendencia"],
      ["Bruno Reis", "presente"],
    ]);
  });

  it("RN-FILA-05: conta não verificada é recusada; a fila e o app mostram a pendência", async () => {
    const r = await checkIn(ana.cookie, tokensDe((await qr()).corpo.conteudo));
    expect(r.corpo).toEqual([
      expect.objectContaining({ pessoa: "Ana Lima", resultado: "pendencia", pendencias: ["conta"] }),
    ]);
    const fila = await c.pedir("GET", `/v1/painel/sessoes/${c.sessaoId}/fila`, recepcao);
    expect(fila.corpo.itens.find((i: { nome: string }) => i.nome === "Ana Lima")).toMatchObject({
      estado: "remoto",
      pendencias: ["conta"],
    });
    const minhas = await app("GET", `${m()}/minhas`, ana.cookie);
    expect(minhas.corpo[0]).toMatchObject({ itemEstado: "remoto", pendencias: ["conta"] });
  });

  it("RN-ID-05: a recepção confere, marca presença e a conta fica verificada para as próximas idas", async () => {
    const fila = await c.pedir("GET", `/v1/painel/sessoes/${c.sessaoId}/fila`, recepcao);
    const item = fila.corpo.itens.find((i: { nome: string }) => i.nome === "Ana Lima");
    const r = await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
      entradaId: item.entradaId,
      resultado: "confere",
    });
    expect(r.corpo.itens.find((i: { nome: string }) => i.nome === "Ana Lima")).toMatchObject({
      estado: "presente",
      pendencias: [],
    });
    const [conta] = await database.select().from(paciente).where(eq(paciente.id, ana.pacienteId));
    expect(conta?.verificadoEm).not.toBeNull();
    expect(conta?.verificadoMetodo).toBe("recepcao");
  });
});

describe('"Vou sair" (RN-PRES-02)', () => {
  const vouSair = (cookie: string, entradaId: string) => app("POST", `${m()}/entradas/${entradaId}/vou-sair`, cookie);
  const doBruno = async () =>
    (await app("GET", `${m()}/minhas`, bruno.cookie)).corpo.find((e: { pessoa: string }) => e.pessoa === "Bruno Reis");

  it("só a conta responsável; presente volta a remoto mantendo a senha; de novo → transicao_proibida", async () => {
    const antes = await doBruno();
    expect(antes).toMatchObject({ itemEstado: "presente" });
    expect((await vouSair(ana.cookie, antes.entradaId)).status).toBe(404);
    const r = await vouSair(bruno.cookie, antes.entradaId);
    expect(r.status).toBe(200);
    expect(await doBruno()).toMatchObject({ itemEstado: "remoto", senha: antes.senha });
    expect(await vouSair(bruno.cookie, antes.entradaId)).toMatchObject({
      status: 409,
      corpo: { erro: "transicao_proibida" },
    });
  });
});

describe('"Não vou poder ir" (RN-CANC-01..03)', () => {
  it("só a conta responsável cancela; libera a vaga; a entrada sai da fila e do app como cancelada", async () => {
    const carla = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Carla Dias" }));
    const r = await inscrever(carla.cookie);
    expect(r.status).toBe(201);
    const id = r.corpo.entradaId;
    expect((await app("POST", `${m()}/entradas/${id}/cancelar`, ana.cookie)).status).toBe(404);
    const c = await app("POST", `${m()}/entradas/${id}/cancelar`, carla.cookie);
    expect(c.status).toBe(200);
    const minhas = await app("GET", `${m()}/minhas`, carla.cookie);
    expect(minhas.corpo.find((e: { entradaId: string }) => e.entradaId === id)).toBeUndefined();
    const fila = await c_fila();
    // Fica no dia como "saiu da fila" (histórico); a vaga volta.
    expect(fila.itens.find((i: { entradaId: string }) => i.entradaId === id)).toMatchObject({ estado: "saiu_da_fila" });
    expect(await app("POST", `${m()}/entradas/${id}/cancelar`, carla.cookie)).toMatchObject({ status: 409 });
  });
});
