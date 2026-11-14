import { eq } from "drizzle-orm";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Revisão de 2026-11-14: o app não pode deixar tentar o que a regra proíbe, e a API recusa cedo e claro.

let c: Awaited<ReturnType<typeof cenarioDaFila>>;

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
const outra = (nome: string, nascimento: string, cpf: string | null) => ({ tipo: "outra", nome, nascimento, cpf });
const inscrever = (cookie: string, paraQuem: unknown) =>
  app("POST", `${m()}/sessoes/${c.sessaoId}/inscricoes`, cookie, { paraQuem, respostas: ROTINA });
const verificar = (cookie: string, paraQuem: unknown) =>
  app("POST", `${m()}/sessoes/${c.sessaoId}/inscricoes/verificar`, cookie, { paraQuem });
const minhas = async (cookie: string) => (await app("GET", `${m()}/minhas`, cookie)).corpo;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("CPF em 'outra pessoa'", () => {
  it("o próprio CPF da conta como 'outra pessoa' → cpf_da_conta (use 'para mim')", async () => {
    const ana = await orchestrator.loginPaciente();
    const r = await inscrever(ana.cookie, outra("Ana Qualquer", "1990-01-01", ana.dados.cpf));
    expect(r).toMatchObject({ status: 409, corpo: { erro: "cpf_da_conta" } });
  });

  it("CPF de quem tem conta no app → pessoa_tem_conta (ela se inscreve pela conta dela)", async () => {
    const dona = await orchestrator.loginPaciente();
    const outraConta = await orchestrator.loginPaciente();
    const r = await inscrever(outraConta.cookie, outra(dona.dados.nome, dona.dados.nascimento, dona.dados.cpf));
    expect(r).toMatchObject({ status: 409, corpo: { erro: "pessoa_tem_conta" } });
  });

  it("dados errados digitados por terceiros não trancam o dono do CPF quando ele cria a conta", async () => {
    const cpf = orchestrator.gerarCpf();
    const tia = await orchestrator.loginPaciente();
    expect((await inscrever(tia.cookie, outra("Nome Errado", "1950-05-05", cpf))).status).toBe(201);
    await app("POST", `${m()}/entradas/${(await minhas(tia.cookie))[0].entradaId}/cancelar`, tia.cookie);
    const dono = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ cpf, nome: "Dono Certo" }));
    expect((await inscrever(dono.cookie, { tipo: "eu" })).status).toBe(201);
    const [p] = await orchestrator.bancoDoMunicipio(c.slug).select().from(pessoaLocal).where(eq(pessoaLocal.cpf, cpf));
    expect(p).toMatchObject({ nome: "Dono Certo", nascimento: dono.dados.nascimento, pacienteId: dono.pacienteId });
  });
});

describe("verificação antes do questionário", () => {
  it("diz já na escolha de 'para quem' que a pessoa já está inscrita, sem criar nada", async () => {
    const bruno = await orchestrator.loginPaciente();
    expect(await verificar(bruno.cookie, { tipo: "eu" })).toMatchObject({ status: 200, corpo: { ok: true } });
    expect(await minhas(bruno.cookie)).toEqual([]);
    await inscrever(bruno.cookie, { tipo: "eu" });
    expect(await verificar(bruno.cookie, { tipo: "eu" })).toMatchObject({ status: 409, corpo: { erro: "duplicada" } });
  });

  it("a mesma 'outra pessoa' sem CPF (mesmo nome e nascimento) não entra duas vezes", async () => {
    const mae = await orchestrator.loginPaciente();
    expect((await inscrever(mae.cookie, outra("Lia Souza", "2019-03-03", null))).status).toBe(201);
    expect(await verificar(mae.cookie, outra("lia  souza", "2019-03-03", null))).toMatchObject({
      status: 409,
      corpo: { erro: "duplicada" },
    });
    // Outro filho com o mesmo nome e outra data de nascimento é outra pessoa.
    expect((await verificar(mae.cookie, outra("Lia Souza", "2021-07-07", null))).status).toBe(200);
  });
});

describe("o que 'minhas' diz para o app decidir", () => {
  it("podeCancelar e o nascimento de cada pessoa", async () => {
    const p = await orchestrator.loginPaciente();
    await inscrever(p.cookie, { tipo: "eu" });
    const [e] = await minhas(p.cookie);
    expect(e).toMatchObject({ podeCancelar: true, nascimento: p.dados.nascimento });
  });
});
