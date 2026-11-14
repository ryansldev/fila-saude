import { cenarioDaFila, inscreverPessoa } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let recepcao: string;
let tv: { codigo: string; token: string };
let tvId: string;
const entradas: Record<string, string> = {};

// A TV fala com a API pelo Host do município e o token do navegador (PD-47), sem cookie.
async function daTv(metodo: string, caminho: string, token?: string) {
  const r = await fetch(`${orchestrator.origemDoTenant(c.slug)}${caminho}`, {
    method: metodo,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : undefined };
}
const tela = (token = tv.token) => daTv("GET", "/v1/tv/tela", token);
const parear = (codigo: string, cookie = c.admin) =>
  c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/tvs`, cookie, { codigo });

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
  for (const nome of ["Ana", "Bruno", "Carla"]) entradas[nome] = (await inscreverPessoa(c.slug, c.sessaoId, nome)).id;
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("pareamento da TV (RN-TV-01, RN-TV-02)", () => {
  it("a TV se registra e mostra o código de 6 dígitos; sem token, nada", async () => {
    const r = await daTv("POST", "/v1/tv");
    expect(r.status).toBe(201);
    expect(r.corpo.codigo).toMatch(/^\d{6}$/);
    tv = r.corpo;
    expect((await tela()).corpo).toMatchObject({ estado: "aguardando", codigo: tv.codigo });
    expect((await tela("inventado")).status).toBe(401);
  });

  it("só quem configura a unidade pareia; código errado → codigo_invalido", async () => {
    expect((await parear(tv.codigo, recepcao)).status).toBe(403);
    expect((await parear(tv.codigo === "000000" ? "111111" : "000000")).corpo.erro).toBe("codigo_invalido");
    const r = await parear(tv.codigo);
    expect(r.status).toBe(201);
    tvId = r.corpo.id;
    expect((await parear(tv.codigo)).corpo.erro).toBe("codigo_invalido");
  });

  it("pareada: mostra a unidade; o painel lista a TV online", async () => {
    expect((await tela()).corpo).toMatchObject({
      estado: "pareada",
      unidade: { id: c.unidadeId },
      chamadas: [],
      qr: null,
    });
    const lista = await c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/tvs`, c.admin);
    expect(lista.corpo).toEqual([expect.objectContaining({ id: tvId, online: true })]);
  });
});

describe("tela da TV (RN-TV-03, RN-TV-05, RN-TV-07)", () => {
  it("contadores por serviço, chamadas com senha e destino e nunca nomes; QR com a sessão aberta", async () => {
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    for (const n of ["Ana", "Bruno"]) {
      await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
        entradaId: entradas[n],
        resultado: "confere",
      });
    }
    expect((await tela()).corpo.servicos).toEqual([{ nome: "Clínico", aguardando: 2, aCaminho: 1 }]);
    await c.pedir("POST", `/v1/painel/estacoes/${c.e1}/chamar`, c.enfermeiro, {});
    await c.pedir("POST", `/v1/painel/estacoes/${c.e2}/chamar`, c.enfermeiro, {});
    const r = (await tela()).corpo;
    expect(r.chamadas.map((x: { senha: string; destino: string }) => [x.senha, x.destino])).toEqual([
      ["C-002", "Sala 2"],
      ["C-001", "Sala 1"],
    ]);
    expect(r.destaqueSegundos).toBe(10);
    expect(r.qr.conteudo).toMatch(/^filasaude:\/\/check-in\?/);
    expect(JSON.stringify(r)).not.toMatch(/Ana|Bruno|Carla/);
  });

  it("revogada: a TV perde o acesso e volta a se registrar", async () => {
    expect((await c.pedir("DELETE", `/v1/painel/tvs/${tvId}`, recepcao)).status).toBe(403);
    expect((await c.pedir("DELETE", `/v1/painel/tvs/${tvId}`, c.admin)).status).toBe(200);
    expect(await tela()).toMatchObject({ status: 401, corpo: { erro: "tv_nao_pareada" } });
  });
});
