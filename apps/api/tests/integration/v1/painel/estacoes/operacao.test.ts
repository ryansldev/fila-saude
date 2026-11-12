import { eq } from "drizzle-orm";
import { entrada } from "infra/database/municipal/schema/entrada";
import { cenarioDaFila, inscreverPessoa } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let recepcao: string;
let tecnico: string;
const entradas: Record<string, string> = {};

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
  tecnico = (await usuarioLogado(c.slug, c.gestor, "tecnico", ocupacao(c.unidadeId, "tecnico_enfermagem"))).cookie;
  for (const nome of ["Ana", "Bruno", "Carla"]) entradas[nome] = (await inscreverPessoa(c.slug, c.sessaoId, nome)).id;
  await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
});
afterAll(() => orchestrator.derrubarMunicipios());

const op = (estacaoId: string, cookie: string, comando?: string) =>
  comando
    ? c.pedir("POST", `/v1/painel/estacoes/${estacaoId}/${comando}`, cookie, {})
    : c.pedir("GET", `/v1/painel/estacoes/${estacaoId}/operacao`, cookie);
const presenca = (nome: string, cookie = recepcao) =>
  c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, cookie, {
    entradaId: entradas[nome],
    resultado: "confere",
  });

describe("estação de chamada (T3.7)", () => {
  it("RN-FILA-05: só a recepção marca presença; remoto não é chamado", async () => {
    expect((await op(c.e1, c.enfermeiro, "chamar")).corpo.aviso).toBe("ninguem_aguardando");
    expect((await presenca("Ana", c.enfermeiro)).status).toBe(403);
    for (const n of ["Ana", "Bruno", "Carla"]) expect((await presenca(n)).status).toBe(200);
    const r = await op(c.e1, c.enfermeiro);
    expect(r.corpo).toMatchObject({ estacao: { nome: "Sala 1" }, chamado: null, aguardando: 3 });
  });

  it("PD-46: gerente não opera; técnico só na triagem → 403 na estação de atendimento", async () => {
    expect((await op(c.e1, c.admin, "chamar")).status).toBe(403);
    expect((await op(c.e1, tecnico, "chamar")).status).toBe(403);
  });

  it("INV-04 / L-003: duas estações chamando ao mesmo tempo recebem pacientes diferentes", async () => {
    const [a, b] = await Promise.all([op(c.e1, c.enfermeiro, "chamar"), op(c.e2, c.enfermeiro, "chamar")]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const nomes = [a.corpo.chamado.nome, b.corpo.chamado.nome].sort();
    expect(nomes).toEqual(["Ana", "Bruno"]);
  });

  it("RN-CHAM-02/03: rechamar mantém; não compareceu pula; finalizar conclui a entrada", async () => {
    const r = await op(c.e1, c.enfermeiro, "rechamar");
    expect(r.status).toBe(200);
    const chamadoE1 = r.corpo.chamado.nome as string;
    const pulo = await op(c.e1, c.enfermeiro, "nao-compareceu");
    expect(pulo.corpo.chamado).toBeNull();
    const fim = await op(c.e2, c.enfermeiro, "finalizar");
    expect(fim.corpo.chamado).toBeNull();
    const nomeE2 = chamadoE1 === "Ana" ? "Bruno" : "Ana";
    const [linha] = await orchestrator
      .bancoDoMunicipio(c.slug)
      .select({ estado: entrada.estado })
      .from(entrada)
      .where(eq(entrada.id, entradas[nomeE2] as string));
    expect(linha?.estado).toBe("concluida");
  });

  it("RN-CHAM-01: chamar sem ninguém finaliza o chamado e avisa", async () => {
    // Restam Carla e quem foi pulado (presente de novo); chama até esvaziar.
    let r = await op(c.e1, c.enfermeiro, "chamar");
    for (let i = 0; i < 4 && r.corpo.aviso === null; i++) r = await op(c.e1, c.enfermeiro, "chamar");
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ chamado: null, aviso: "ninguem_aguardando", aguardando: 0 });
  });
});
