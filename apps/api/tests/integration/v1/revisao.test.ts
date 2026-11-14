import { eq } from "drizzle-orm";
import database from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { tv } from "infra/database/municipal/schema/tv";
import webserver from "infra/webserver";
import { cenarioDaFila, inscreverPessoa, ROTINA } from "tests/fila";
import orchestrator from "tests/orchestrator";
import { gerente, ocupacao, usuarioLogado } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Revisão de 2026-11-13: cada caso aqui era um bug encontrado na revisão de todas as fatias.

let c: Awaited<ReturnType<typeof cenarioDaFila>>;
let recepcao: string;

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
const sessao = (inicio: number, fim: number, estacoes = [c.e1]) =>
  c.pedir("POST", `/v1/painel/unidades/${c.unidadeId}/sessoes`, c.admin, {
    servicoId: c.servicoId,
    inicio: new Date(inicio).toISOString(),
    fim: new Date(fim).toISOString(),
    vagas: 10,
    visibilidade: "publica",
    dispensaPreCadastro: false,
    profissional: null,
    estacoes,
  });

// Não há GET de uma sessão: a versão vem da lista da unidade.
async function lerSessao(id: string) {
  const de = new Date(Date.now() - 5 * 86400_000).toISOString();
  const ate = new Date(Date.now() + 5 * 86400_000).toISOString();
  const r = await c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/sessoes?de=${de}&ate=${ate}`, c.admin);
  return (r.corpo as { id: string; versao: number; ocupadas: number }[]).find((s) => s.id === id);
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await cenarioDaFila();
  recepcao = (await usuarioLogado(c.slug, c.gestor, "recepcao", ocupacao(c.unidadeId, "recepcao"))).cookie;
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("identidade (CPF e nascimento)", () => {
  it("'outra pessoa' com o CPF de alguém já cadastrado e outros dados → pessoa_divergente, sem vazar o nome", async () => {
    const vitima = await orchestrator.loginPaciente(orchestrator.dadosDeCadastro({ nome: "Vera Lúcia" }));
    await app("POST", `${m()}/sessoes/${c.sessaoId}/inscricoes`, vitima.cookie, {
      paraQuem: { tipo: "eu" },
      respostas: ROTINA,
    });
    const atacante = await orchestrator.loginPaciente();
    const r = await app("POST", `${m()}/sessoes/${c.sessaoId}/inscricoes`, atacante.cookie, {
      paraQuem: { tipo: "outra", nome: "Qualquer Um", nascimento: "2000-01-01", cpf: vitima.dados.cpf },
      respostas: ROTINA,
    });
    // A vítima tem conta: a recusa vem antes, sem conferir dados (2026-11-14).
    expect(r).toMatchObject({ status: 409, corpo: { erro: "pessoa_tem_conta" } });
    expect(JSON.stringify(r.corpo)).not.toMatch(/Vera/);
  });

  it("conta verificada não troca a data de nascimento sozinha; nome vazio é recusado", async () => {
    const p = await orchestrator.loginPaciente();
    expect((await app("POST", "/v1/auth/update-user", p.cookie, { name: "" })).status).toBe(400);
    await database.update(paciente).set({ verificadoEm: new Date() }).where(eq(paciente.id, p.pacienteId));
    const r = await app("POST", "/v1/auth/update-user", p.cookie, { nascimento: "1930-01-01" });
    expect(r).toMatchObject({ status: 409, corpo: { erro: "nascimento_verificado" } });
  });

  it("login da equipe só com letras, números, ponto ou _ (senão a pessoa nunca entraria)", async () => {
    const r = await c.pedir("POST", "/v1/painel/usuarios", c.gestor, {
      login: "maria silva",
      nome: "Maria",
      senha: "segredo123",
      ...gerente(c.unidadeId),
    });
    expect(r.status).toBe(400);
  });
});

describe("sessões e estações", () => {
  it("sessão sem estação de atendimento é recusada (ninguém seria chamado)", async () => {
    const agora = Date.now();
    const r = await sessao(agora + 86400_000, agora + 90000_000, []);
    expect(r).toMatchObject({ status: 400, corpo: { campos: { estacoes: [expect.any(String)] } } });
  });

  it("inscrição depois do fim da sessão → sessao_fechada", async () => {
    const agora = Date.now();
    const s = await sessao(agora - 5 * 3600_000, agora - 3600_000);
    expect(s.status).toBe(201);
    const p = await orchestrator.loginPaciente();
    const r = await app("POST", `${m()}/sessoes/${s.corpo.id}/inscricoes`, p.cookie, {
      paraQuem: { tipo: "eu" },
      respostas: ROTINA,
    });
    expect(r).toMatchObject({ status: 409, corpo: { erro: "sessao_fechada" } });
  });

  it("estação de sessão aberta não é arquivada nem tirada da sessão (ficaria impossível encerrar)", async () => {
    await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/abrir`, c.admin);
    expect(await c.pedir("DELETE", `/v1/painel/estacoes/${c.e2}`, c.admin)).toMatchObject({
      status: 409,
      corpo: { erro: "estacao_em_uso" },
    });
    const atual = await lerSessao(c.sessaoId);
    const r = await c.pedir("PATCH", `/v1/painel/sessoes/${c.sessaoId}`, c.admin, {
      versao: atual?.versao,
      estacoes: [c.e1],
    });
    expect(r).toMatchObject({ status: 409, corpo: { erro: "transicao_proibida" } });
  });

  it("sessão aberta de outro dia continua na lista do painel até alguém encerrar", async () => {
    const agora = Date.now();
    const ontem = await sessao(agora - 30 * 3600_000, agora - 26 * 3600_000);
    await c.pedir("POST", `/v1/painel/sessoes/${ontem.corpo.id}/abrir`, c.admin);
    const hoje = await c.pedir("GET", `/v1/painel/unidades/${c.unidadeId}/hoje`, recepcao);
    expect(hoje.corpo.sessoes.map((s: { id: string }) => s.id)).toContain(ontem.corpo.id);
  });

  it("RN-PUB-02: mais vagas promovem quem está na reserva", async () => {
    const agora = Date.now();
    const s = await sessao(agora + 2 * 86400_000, agora + 2 * 86400_000 + 3600_000);
    await c.pedir("PATCH", `/v1/painel/sessoes/${s.corpo.id}`, c.admin, { versao: s.corpo.versao, vagas: 1 });
    await inscreverPessoa(c.slug, s.corpo.id, "Primeira");
    const reserva = await inscreverPessoa(c.slug, s.corpo.id, "Segunda");
    expect(reserva.estado).toBe("na_reserva");
    const v = await lerSessao(s.corpo.id);
    const r = await c.pedir("PATCH", `/v1/painel/sessoes/${s.corpo.id}`, c.admin, { versao: v?.versao, vagas: 2 });
    expect(r.corpo.ocupadas).toBe(2);
  });
});

describe("presença e TV", () => {
  it("'não confere' sem motivo → motivo_obrigatorio", async () => {
    const e = await inscreverPessoa(c.slug, c.sessaoId, "Sem Documento");
    const r = await c.pedir("POST", `/v1/painel/sessoes/${c.sessaoId}/presenca`, recepcao, {
      entradaId: e.id,
      resultado: "nao_confere",
    });
    expect(r).toMatchObject({ status: 400, corpo: { erro: "motivo_obrigatorio" } });
  });

  it("RN-PRES-03: a recepção vê o que conferir no documento (nascimento e CPF mascarado)", async () => {
    const fila = await c.pedir("GET", `/v1/painel/sessoes/${c.sessaoId}/fila`, recepcao);
    const item = fila.corpo.itens.find((i: { nome: string }) => i.nome === "Sem Documento");
    expect(item.documento).toEqual({ nascimento: "1990-05-05", cpf: expect.stringMatching(/^•••\.\d{3}\.\d{3}-••$/) });
  });

  it("código da TV vencido: o servidor decide (o relógio da TV não importa) e só uma TV é pareada", async () => {
    const reg = async () => {
      const r = await fetch(`${orchestrator.origemDoTenant(c.slug)}/v1/tv`, { method: "POST" });
      return (await r.json()) as { codigo: string; token: string };
    };
    const tela = async (token: string) =>
      (
        await fetch(`${orchestrator.origemDoTenant(c.slug)}/v1/tv/tela`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status;
    const velha = await reg();
    await orchestrator
      .bancoDoMunicipio(c.slug)
      .update(tv)
      .set({ criadaEm: new Date(Date.now() - 20 * 60_000) })
      .where(eq(tv.codigo, velha.codigo));
    expect(await tela(velha.token)).toBe(401);
    // Códigos pendentes não se repetem.
    const codigos = new Set<string>();
    for (let i = 0; i < 20; i++) codigos.add((await reg()).codigo);
    expect(codigos.size).toBe(20);
  });

  it("o app tira o aparelho da conta ao sair (push)", async () => {
    const p = await orchestrator.loginPaciente();
    await app("PUT", "/v1/paciente/push", p.cookie, { token: "ExponentPushToken[sair]" });
    expect((await app("DELETE", "/v1/paciente/push", p.cookie, { token: "ExponentPushToken[sair]" })).status).toBe(200);
  });
});

describe("abusos e configurações", () => {
  it("uma conta não lota uma sessão com pessoas inventadas: no máximo 5 inscrições ativas por sessão", async () => {
    const p = await orchestrator.loginPaciente();
    const outra = (i: number) =>
      app("POST", `${m()}/sessoes/${c.sessaoId}/inscricoes`, p.cookie, {
        paraQuem: { tipo: "outra", nome: `Pessoa ${i}`, nascimento: "2000-01-01", cpf: null },
        respostas: ROTINA,
      });
    for (let i = 0; i < 5; i++) expect((await outra(i)).status).toBe(201);
    expect(await outra(6)).toMatchObject({ status: 409, corpo: { erro: "limite_por_conta" } });
  });

  it("não atribui ninguém a uma unidade removida", async () => {
    const id = await orchestrator.criarUnidadeDireto(c.slug, "UBS Fechada");
    const u = { corpo: { id: typeof id === "string" ? id : (id as { id: string }).id } };
    expect((await c.pedir("DELETE", `/v1/painel/unidades/${u.corpo.id}`, c.gestor)).status).toBeLessThan(300);
    const r = await c.pedir("POST", "/v1/painel/usuarios", c.gestor, {
      login: "na_fechada",
      nome: "Na Fechada",
      senha: "segredo123",
      ...gerente(u.corpo.id),
    });
    expect(r.status).toBe(400);
  });

  it("quem é da equipe não troca o próprio login ou nome por fora da tela de equipe", async () => {
    const r = await c.pedir("POST", "/v1/painel/auth/update-user", recepcao, { username: "outro_login" });
    expect(r.status).toBe(404);
  });
});
