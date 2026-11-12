import { abrir, type Respostas } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import { estacao, estacaoServico } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao, sessaoEstacao } from "infra/database/municipal/schema/sessao";
import { lerDia, montarDia, naSessao } from "infra/fila/dia";
import { entrarNaLista } from "infra/fila/entradas";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let servicoId: string;
let estacaoId: string;

const respostas: Respostas = { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] };
const agora = Date.UTC(2026, 10, 12, 12);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.criarMunicipio({ gestor: null }));
  const unidadeId = await orchestrator.criarUnidadeDireto(slug);
  const db = orchestrator.bancoDoMunicipio(slug);
  const [s] = await db
    .insert(servico)
    .values({ unidadeId, nome: "Clínico", prefixo: "C", tempoMedioAtendimentoMin: 12 })
    .returning();
  servicoId = s?.id as string;
  const [e] = await db.insert(estacao).values({ unidadeId, nome: "Sala 1", etapa: "atendimento" }).returning();
  estacaoId = e?.id as string;
  await db.insert(estacaoServico).values({ estacaoId, servicoId });
});
afterAll(() => orchestrator.derrubarMunicipios());

const db = () => orchestrator.bancoDoMunicipio(slug);

async function novaSessao() {
  const [s] = await db()
    .insert(sessao)
    .values({
      servicoId,
      inicio: new Date(agora),
      fim: new Date(agora + 4 * 3600_000),
      vagas: 10,
      visibilidade: "publica",
    })
    .returning();
  await db()
    .insert(sessaoEstacao)
    .values({ sessaoId: s?.id as string, estacaoId });
  return s?.id as string;
}

describe("fila do dia (PD-43, PD-44)", () => {
  it("PD-44: sessão planejada não tem dia gravado; montarDia usa serviço, estações e config", async () => {
    const id = await novaSessao();
    expect(await lerDia(db(), id)).toBeNull();
    const dia = await montarDia(db(), id);
    expect(dia).toMatchObject({
      sessaoId: id,
      servicoId,
      estado: "planejada",
      prefixoSenha: "C",
      exigeTriagem: false,
      proximoNumero: 1,
      tempoInicialMin: { atendimento: 12 },
      estacoes: [{ id: estacaoId, etapa: "atendimento", servicos: [servicoId], aberta: true, chamadoItemId: null }],
    });
    expect(dia.config.fuso).toBe("America/Sao_Paulo");
  });

  it("PD-43: abrir grava o dia, o estado da sessão e as entradas na mesma transação", async () => {
    const id = await novaSessao();
    const e = await entrarNaLista(db(), {
      servicoId,
      pessoa: { nome: "Ana", nascimento: "1980-01-01", cpf: orchestrator.gerarCpf(), pacienteId: null },
      responsavelPacienteId: null,
      respostas,
      agora,
    });
    if (!e.ok) throw new Error(e.erro);
    // Confirmada na sessão, como depois de uma inscrição.
    await naSessao(db(), id, async (c) => ({
      entradas: [{ ...e.estado, estado: "confirmada", sessaoId: id }],
      sessao: { ...c.sessao, ocupadas: 1 },
      resultado: null,
    }));
    await naSessao(db(), id, async (c) => {
      const r = abrir(c.dia ?? (await montarDia(c.tx, id)), c.entradas, agora);
      if (!r.ok) throw new Error(r.erro);
      return { dia: r.estado.dia, entradas: r.estado.entradas, resultado: null };
    });
    const dia = await lerDia(db(), id);
    expect(dia?.estado).toBe("aberta");
    expect(dia?.itens.map((i) => i.senha)).toEqual(["C-001"]);
    const [linha] = await db().select().from(sessao).where(eq(sessao.id, id));
    expect(linha).toMatchObject({ estado: "aberta", ocupadas: 1 });
    await naSessao(db(), id, async (c) => {
      expect(c.entradas.map((x) => x.estado)).toEqual(["na_fila"]);
      return { resultado: null };
    });
  });

  it("L-003: duas transações na mesma sessão ficam em série e nenhuma perde a escrita", async () => {
    const id = await novaSessao();
    const soma = () =>
      naSessao(db(), id, async (c) => {
        await new Promise((r) => setTimeout(r, 50));
        return { sessao: { ...c.sessao, ocupadas: c.sessao.ocupadas + 1 }, resultado: null };
      });
    await Promise.all([soma(), soma(), soma()]);
    const [linha] = await db().select().from(sessao).where(eq(sessao.id, id));
    expect(linha?.ocupadas).toBe(3);
  });
});
