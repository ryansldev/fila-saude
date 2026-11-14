import { asc, eq } from "drizzle-orm";
import { type Envio, varrerMunicipio } from "infra/avisos/varredura";
import { aviso } from "infra/database/municipal/schema/aviso";
import webserver from "infra/webserver";
import { cenarioDaFila, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let recepcao: string;
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

// Enviador de mentira: guarda o que mandaria e responde ok (ou erro, para testar a nova tentativa).
function enviador(falhar = false) {
  const enviados: Envio[] = [];
  return {
    enviados,
    enviar: async (lista: Envio[]) => {
      enviados.push(...lista);
      return lista.map(() => (falhar ? { ok: false as const, erro: "fora do ar" } : { ok: true as const }));
    },
  };
}

const db = () => orchestrator.bancoDoMunicipio(c.slug);
const avisos = () => db().select().from(aviso).orderBy(asc(aviso.criadoEm));
const doPaciente = async (nome: string) =>
  (await avisos()).filter((a) => a.pacienteId === contas[nome]?.pacienteId).map((a) => a.tipo);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
  for (const nome of ["Ana", "Bruno", "Carla", "Davi"]) {
    contas[nome] = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome }));
    const r = await app("POST", `/v1/municipios/${c.slug}/sessoes/${c.sessaoId}/inscricoes`, contas[nome]?.cookie, {
      paraQuem: { tipo: "eu" },
      respostas: ROTINA,
    });
    entradas[nome] = r.corpo.entradaId;
  }
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("avisos por push (T3.8, T2.4)", () => {
  it("o app registra o token de push da conta; sem conta → 401", async () => {
    expect((await app("PUT", "/v1/paciente/push", undefined, { token: "ExponentPushToken[x]" })).status).toBe(401);
    for (const nome of ["Ana", "Carla"]) {
      const r = await app("PUT", "/v1/paciente/push", contas[nome]?.cookie, { token: `ExponentPushToken[${nome}]` });
      expect(r.status).toBe(200);
    }
  });

  it("chamar grava 'sua vez' na mesma transação, com senha e sala e sem dado clínico (RN-NOT-01)", async () => {
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    for (const n of ["Ana", "Bruno"]) {
      await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
        entradaId: entradas[n],
        resultado: "confere",
      });
    }
    await c.pedir("POST", `/v1/painel/estacoes/${c.e1}/chamar`, c.enfermeiro, {});
    const [a] = await avisos();
    expect(a).toMatchObject({ tipo: "sua_vez", pacienteId: contas.Ana?.pacienteId, estado: "pendente" });
    expect(a?.titulo).toMatch(/sua vez/);
    expect(`${a?.titulo} ${a?.corpo}`).toMatch(/C-001/);
    expect(a?.corpo).toMatch(/sala 1/);
  });

  it("a varredura gera 'venha agora' e 'saia de casa' uma vez só e envia; sem token fica sem_dispositivo", async () => {
    await c.pedir("POST", `/v1/painel/estacoes/${c.e2}/chamar`, c.enfermeiro, {});
    const e = enviador();
    await varrerMunicipio(db(), Date.now(), e.enviar);
    expect(await doPaciente("Carla")).toEqual(["venha_agora"]);
    expect(await doPaciente("Davi")).toEqual(["saia_de_casa"]);
    // A tela do app concorda com o push: "hora de sair de casa".
    const minhas = await app("GET", `/v1/municipios/${c.slug}/minhas`, contas.Davi?.cookie);
    expect(minhas.corpo[0]).toMatchObject({ saiaDeCasa: true });
    expect(e.enviados.map((x) => x.para).sort()).toEqual(["ExponentPushToken[Ana]", "ExponentPushToken[Carla]"]);
    const porTipo = Object.fromEntries((await avisos()).map((a) => [`${a.tipo}:${a.pacienteId}`, a.estado]));
    expect(porTipo[`sua_vez:${contas.Bruno?.pacienteId}`]).toBe("sem_dispositivo");
    expect(porTipo[`sua_vez:${contas.Ana?.pacienteId}`]).toBe("enviado");

    const outra = enviador();
    await varrerMunicipio(db(), Date.now(), outra.enviar);
    expect(outra.enviados).toEqual([]);
    expect((await avisos()).length).toBe(4);
  });

  it("'você foi pulado' com nova tentativa quando o envio falha", async () => {
    await c.pedir("POST", `/v1/painel/estacoes/${c.e1}/nao-compareceu`, c.enfermeiro, {});
    expect(await doPaciente("Ana")).toEqual(["sua_vez", "pulado"]);
    const agora = Date.now();
    await varrerMunicipio(db(), agora, enviador(true).enviar);
    const [pulo] = (await avisos()).filter((a) => a.tipo === "pulado");
    expect(pulo).toMatchObject({ estado: "pendente", tentativas: 1 });
    expect(pulo?.proximaTentativaEm.getTime()).toBeGreaterThan(agora);

    const cedo = enviador();
    await varrerMunicipio(db(), agora + 1000, cedo.enviar);
    expect(cedo.enviados).toEqual([]);
    const depois = enviador();
    await varrerMunicipio(db(), agora + 10 * 60_000, depois.enviar);
    expect(depois.enviados.map((x) => x.para)).toEqual(["ExponentPushToken[Ana]"]);
    const [enviado] = await db()
      .select()
      .from(aviso)
      .where(eq(aviso.id, pulo?.id as string));
    expect(enviado?.estado).toBe("enviado");
  });
});
