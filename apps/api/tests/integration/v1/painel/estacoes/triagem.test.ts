import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { eq } from "drizzle-orm";
import { entrada } from "infra/database/municipal/schema/entrada";
import webserver from "infra/webserver";
import { cenarioDaFila, inscreverPessoa, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let t1: string;
let davi: Awaited<ReturnType<typeof orchestrator.loginPaciente>>;
const entradas: Record<string, string> = {};

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila({ triagem: true });
  t1 = c.t1 as string;
  const recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
  const respostas = {
    Ana: { ...ROTINA, alarmes: ["autolesao" as const] },
    Bruno: { ...ROTINA, motivo: "novo" as const, gravidade: "moderado" as const },
    Carla: ROTINA,
  };
  for (const [nome, r] of Object.entries(respostas))
    entradas[nome] = (await inscreverPessoa(c.slug, c.sessaoId, nome, r)).id;
  // Davi tem conta: o app dele mostra a etapa.
  davi = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Davi" }));
  const insc = await doApp("POST", `/v1/municipios/${c.slug}/sessoes/${c.sessaoId}/inscricoes`, davi.cookie, {
    paraQuem: { tipo: "eu" },
    respostas: ROTINA,
  });
  entradas.Davi = (insc as { entradaId: string }).entradaId;
  await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
  for (const n of [...Object.keys(respostas), "Davi"]) {
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
      entradaId: entradas[n],
      resultado: "confere",
    });
  }
});
afterAll(() => orchestrator.derrubarMunicipios());

async function doApp(metodo: string, caminho: string, cookie: string, corpo?: unknown): Promise<unknown> {
  const r = await fetch(`${webserver.origin}${caminho}`, {
    method: metodo,
    headers: { cookie, ...(corpo !== undefined ? { "content-type": "application/json" } : {}) },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  return r.json();
}

const cmd = (estacaoId: string, comando: string, corpo: unknown = {}) =>
  c.pedir("POST", `/v1/painel/estacoes/${estacaoId}/${comando}`, c.enfermeiro, corpo);
const riscoGravado = async (nome: string) => {
  const [e] = await orchestrator
    .bancoDoMunicipio(c.slug)
    .select({ r: entrada.riscoConfirmado, estado: entrada.estado })
    .from(entrada)
    .where(eq(entrada.id, entradas[nome] as string));
  return e;
};

describe("triagem (T6.1, fatia 3)", () => {
  it("RN-TRI-01: a sala de atendimento não chama quem ainda não foi triado", async () => {
    expect((await cmd(c.e1, "chamar")).corpo.aviso).toBe("ninguem_aguardando");
  });

  it("RN-RISCO-06: a triagem vê o sugerido, a regra e o alerta de apoio de quem chamou", async () => {
    const r = await cmd(t1, "chamar");
    expect(r.status).toBe(200);
    expect(r.corpo.chamado).toMatchObject({
      nome: "Ana",
      triagem: { riscoSugerido: "urgente", apoio: true, regra: expect.stringMatching(/própria vida/) },
    });
  });

  it("H3: com alguém chamado, finalizar ou chamar o próximo na triagem pede a classificação", async () => {
    for (const comando of ["finalizar", "chamar"]) {
      const r = await cmd(t1, comando);
      expect(r.status).toBe(422);
      expect(r.corpo.erro).toBe("classifique_o_risco");
    }
  });

  it("RN-TRI-03/04, INV-07: chamar o próximo confirma o risco de quem sai e grava na entrada", async () => {
    const r = await cmd(t1, "chamar", { riscoConfirmado: "atencao" });
    expect(r.status).toBe(200);
    expect(r.corpo.chamado.nome).toBe("Bruno");
    expect(await riscoGravado("Ana")).toEqual({ r: "atencao", estado: "na_fila" });
  });

  it("AD-059: encaminhar à emergência (só com vermelho) conclui a entrada", async () => {
    expect((await cmd(t1, "finalizar", { riscoConfirmado: "urgente", encaminhar: true })).status).toBe(409);
    const r = await cmd(t1, "finalizar", { riscoConfirmado: "emergencia", encaminhar: true });
    expect(r.status).toBe(200);
    expect(r.corpo.chamado).toBeNull();
    expect(await riscoGravado("Bruno")).toEqual({ r: "emergencia", estado: "concluida" });
  });

  it("RN-TRI-04: o triado entra na fila do atendimento; a sala não aceita classificação", async () => {
    const r = await cmd(c.e1, "chamar");
    expect(r.corpo.chamado).toMatchObject({ nome: "Ana", etapa: "atendimento" });
    expect(r.corpo.chamado.triagem).toBeUndefined();
    expect((await cmd(c.e1, "finalizar", { riscoConfirmado: "rotina" })).status).toBe(409);
  });

  it("app: a etapa de quem espera, 'triado' depois da triagem e 'encaminhado' no vermelho", async () => {
    const minha = async () =>
      ((await doApp("GET", `/v1/municipios/${c.slug}/minhas`, davi.cookie)) as MinhaEntrada[])[0];
    expect(await minha()).toMatchObject({ etapa: "triagem", triado: false, encaminhado: false });
    await cmd(t1, "chamar", { riscoConfirmado: "rotina" }); // ninguém chamado: a cor é ignorada; chama Carla
    // AD-059: vermelho sem encaminhar fica na unidade, em 1º no atendimento.
    await cmd(t1, "chamar", { riscoConfirmado: "emergencia" }); // Carla sai da triagem; Davi é chamado
    expect(await riscoGravado("Carla")).toEqual({ r: "emergencia", estado: "na_fila" });
    await cmd(t1, "finalizar", { riscoConfirmado: "muito_urgente" }); // AD-058: laranja do Manchester
    expect(await minha()).toMatchObject({
      etapa: "atendimento",
      triado: true,
      itemEstado: "presente",
      encaminhado: false,
    });
    expect(await riscoGravado("Davi")).toEqual({ r: "muito_urgente", estado: "na_fila" });
  });
});
