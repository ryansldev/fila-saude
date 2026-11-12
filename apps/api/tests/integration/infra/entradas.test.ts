import { type Respostas, TRANSICOES_ENTRADA } from "@fila-saude/domain";
import { eq, sql } from "drizzle-orm";
import { entrada } from "infra/database/municipal/schema/entrada";
import { servico } from "infra/database/municipal/schema/servico";
import { entrarNaLista, lerEntrada, pessoaAtendida } from "infra/fila/entradas";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let servicoId: string;
let reguladoId: string;

const respostas: Respostas = { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] };
const agora = Date.UTC(2026, 10, 12, 12);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.criarMunicipio({ gestor: null }));
  const unidadeId = await orchestrator.criarUnidadeDireto(slug);
  const db = orchestrator.bancoDoMunicipio(slug);
  const [s] = await db.insert(servico).values({ unidadeId, nome: "Odonto", prefixo: "O" }).returning();
  const [r] = await db.insert(servico).values({ unidadeId, nome: "Reg", prefixo: "R", modo: "regulado" }).returning();
  servicoId = s?.id as string;
  reguladoId = r?.id as string;
});
afterAll(() => orchestrator.derrubarMunicipios());

const db = () => orchestrator.bancoDoMunicipio(slug);
const pessoa = (cpf: string | null, pacienteId: string | null = null, nome = "Ana Souza") => ({
  nome,
  nascimento: "1958-03-10",
  cpf,
  pacienteId,
});

describe("entradas", () => {
  it("PD-36: entrada criada pelo domínio volta igual do banco; RN-LE-05 recusa duplicada", async () => {
    const cpf = orchestrator.gerarCpf();
    const r = await entrarNaLista(db(), {
      servicoId,
      pessoa: pessoa(cpf, "pac-1"),
      responsavelPacienteId: "pac-1",
      respostas,
      agora,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await lerEntrada(db(), r.estado.id)).toEqual(r.estado);
    const dup = await entrarNaLista(db(), {
      servicoId,
      pessoa: pessoa(cpf),
      responsavelPacienteId: null,
      respostas,
      agora,
    });
    expect(dup).toMatchObject({ ok: false, erro: "duplicada" });
  });

  it("RN-LE-02 / AD-035: mesmo CPF é a mesma pessoa_local, e ganha o paciente_id", async () => {
    const cpf = orchestrator.gerarCpf();
    const a = await pessoaAtendida(db(), pessoa(cpf));
    const b = await pessoaAtendida(db(), pessoa(cpf, "pac-2"));
    expect(b.id).toBe(a.id);
    const linha = await db().execute<{ paciente_id: string }>(
      sql`select paciente_id from pessoa_local where id = ${a.id}`,
    );
    expect(linha.rows[0]?.paciente_id).toBe("pac-2");
  });

  it("INV-01: segunda entrada ativa da mesma pessoa recusada pelo banco; depois de cancelada, aceita", async () => {
    const r = await entrarNaLista(db(), {
      servicoId,
      pessoa: pessoa(null, null, "José Sem App"),
      responsavelPacienteId: null,
      respostas,
      agora,
    });
    if (!r.ok) throw new Error(r.erro);
    const [linha] = await db().select().from(entrada).where(eq(entrada.id, r.estado.id));
    const copia = { ...linha, id: crypto.randomUUID() } as typeof entrada.$inferInsert;
    await expect(db().insert(entrada).values(copia)).rejects.toThrow();
    await db().update(entrada).set({ estado: "cancelada" }).where(eq(entrada.id, r.estado.id));
    await expect(db().insert(entrada).values(copia)).resolves.toBeDefined();
  });

  it("RN-LE-01: serviço regulado não cria", async () => {
    const r = await entrarNaLista(db(), {
      servicoId: reguladoId,
      pessoa: pessoa(null),
      responsavelPacienteId: null,
      respostas,
      agora,
    });
    expect(r).toMatchObject({ ok: false, erro: "servico_regulado" });
  });

  it("contrato: estados da entrada no banco são os do domínio", async () => {
    const r = await db().execute<{ v: string }>(sql`select unnest(enum_range(null::estado_entrada))::text as v`);
    const doDominio = new Set(TRANSICOES_ENTRADA.flatMap((t) => [t.de, t.para]).filter((e) => /^[a-z_]+$/.test(e)));
    expect(new Set(r.rows.map((l) => l.v))).toEqual(doDominio);
  });
});
