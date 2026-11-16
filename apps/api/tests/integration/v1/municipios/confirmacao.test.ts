import { eq } from "drizzle-orm";
import { aviso } from "infra/database/municipal/schema/aviso";
import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let agenda: string;
let privadaId: string;
const contas: Record<string, Awaited<ReturnType<typeof orchestrator.loginPaciente>>> = {};
const entradas: Record<string, string> = {};

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
const minha = async (nome: string) =>
  (await app("GET", `${m()}/minhas`, contas[nome]?.cookie)).corpo.find(
    (e: { entradaId: string }) => e.entradaId === entradas[nome],
  );

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  agenda = (await usuarioLogado(c.slug, c.gestor, "agenda", ocupacao(c.unidadeId, "recepcao", "agendar"))).cookie;
  const inicio = Date.now() + 2 * 86400_000;
  privadaId = (
    await c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/sessoes`, c.admin, {
      servicoId: c.servicoId,
      inicio: new Date(inicio).toISOString(),
      fim: new Date(inicio + 4 * 3600_000).toISOString(),
      vagas: 5,
      visibilidade: "privada",
      dispensaPreCadastro: false,
      profissional: null,
      estacoes: [c.e1],
    })
  ).corpo.id;
  for (const nome of ["Ana", "Bruno"]) {
    contas[nome] = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome }));
    entradas[nome] = (
      await app("POST", `${m()}/servicos/${c.servicoId}/entradas`, contas[nome]?.cookie, {
        paraQuem: { tipo: "eu" },
        respostas: { ...ROTINA, motivo: "novo", gravidade: "moderado" },
      })
    ).corpo.entradaId;
    const r = await c.pedir("POST", `/v1/painel/sessoes/${privadaId}/alocar`, agenda, { entradaId: entradas[nome] });
    if (r.status !== 200) throw new Error(`alocar: ${r.status} ${JSON.stringify(r.corpo)}`);
  }
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("confirmação pelo app (T5.4)", () => {
  it("RN-CONF-01 / I8: alocar grava o push 'confirme' com serviço, unidade e dia, sem sintoma", async () => {
    const lista = await orchestrator
      .bancoDoMunicipio(c.slug)
      .select()
      .from(aviso)
      .where(eq(aviso.entradaId, entradas.Ana as string));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ tipo: "confirme", pacienteId: contas.Ana?.pacienteId });
    expect(lista[0]?.titulo).toBe("confirme sua consulta");
    expect(lista[0]?.corpo).toContain("Clínico");
    expect(lista[0]?.corpo).toContain("UBS Centro");
    expect(lista[0]?.corpo).not.toMatch(/moderado|novo/i);
  });

  it("RN-CONF-01: 'minhas' mostra a alocação com o prazo de confirmação", async () => {
    const e = await minha("Ana");
    expect(e).toMatchObject({ estado: "alocada", sessao: { id: privadaId } });
    expect(Date.parse(e.prazoConfirmacao)).toBeGreaterThan(Date.now());
  });

  it("confirmar é só da conta responsável; depois de confirmada, não confirma de novo", async () => {
    const caminho = `${m()}/entradas/${entradas.Ana}/confirmar`;
    expect((await app("POST", caminho, contas.Bruno?.cookie)).status).toBe(404);
    expect(await app("POST", caminho, contas.Ana?.cookie)).toMatchObject({
      status: 200,
      corpo: { estado: "confirmada" },
    });
    expect((await minha("Ana")).prazoConfirmacao).toBeNull();
    expect((await app("POST", caminho, contas.Ana?.cookie)).status).toBe(409);
  });

  it("RN-CONF-04: recusar libera a vaga e volta à lista com a data original", async () => {
    const r = await app("POST", `${m()}/entradas/${entradas.Bruno}/recusar`, contas.Bruno?.cookie);
    expect(r).toMatchObject({ status: 200, corpo: { estado: "aguardando" } });
    expect(await minha("Bruno")).toMatchObject({ estado: "aguardando", sessao: null });
    const v = await c.pedir("GET", `/v1/painel/sessoes/${privadaId}/alocacao`, agenda);
    expect(v.corpo.sessao.ocupadas).toBe(1);
  });
});
