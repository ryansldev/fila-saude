import { TRANSICOES_SESSAO } from "@fila-saude/domain";
import { sql } from "drizzle-orm";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let unidadeId: string;
let servicoId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.criarMunicipio({ gestor: null }));
  unidadeId = await orchestrator.criarUnidadeDireto(slug);
});
afterAll(() => orchestrator.derrubarMunicipios());

const db = () => orchestrator.bancoDoMunicipio(slug);
const amanha = (h: number) => new Date(Date.UTC(2026, 10, 13, h));

async function falha(p: Promise<unknown>) {
  return p.then(
    () => false,
    () => true,
  );
}

describe("tabelas da configuração", () => {
  it("modelo: padrões — serviço livre, sem triagem, 15 min; sessão privada, planejada, sem dispensa", async () => {
    const [s] = await db().insert(servico).values({ unidadeId, nome: "Clínico", prefixo: "C" }).returning();
    expect(s).toMatchObject({ modo: "livre", exigeTriagem: false, tempoMedioAtendimentoMin: 15, ativo: true });
    servicoId = s?.id as string;
    const [x] = await db()
      .insert(sessao)
      .values({ servicoId, inicio: amanha(11), fim: amanha(15) })
      .returning();
    expect(x).toMatchObject({ visibilidade: "privada", estado: "planejada", dispensaPreCadastro: false, ocupadas: 0 });
  });

  it("T2.3: prefixo repetido na mesma unidade é recusado; de 3 letras aceito, de 4 recusado", async () => {
    expect(await falha(db().insert(servico).values({ unidadeId, nome: "Outro", prefixo: "C" }))).toBe(true);
    expect(await falha(db().insert(servico).values({ unidadeId, nome: "Três", prefixo: "ABC" }))).toBe(false);
    expect(await falha(db().insert(servico).values({ unidadeId, nome: "Quatro", prefixo: "ABCD" }))).toBe(true);
    const outra = await orchestrator.criarUnidadeDireto(slug, "UBS 2");
    expect(await falha(db().insert(servico).values({ unidadeId: outra, nome: "C2", prefixo: "C" }))).toBe(false);
  });

  it("INV-02: vagas 0 recusado, 1 aceito; ocupadas = vagas aceito, vagas + 1 recusado", async () => {
    const base = { servicoId, inicio: amanha(11), fim: amanha(15) };
    expect(
      await falha(
        db()
          .insert(sessao)
          .values({ ...base, vagas: 0 }),
      ),
    ).toBe(true);
    expect(
      await falha(
        db()
          .insert(sessao)
          .values({ ...base, vagas: 1, ocupadas: 1 }),
      ),
    ).toBe(false);
    expect(
      await falha(
        db()
          .insert(sessao)
          .values({ ...base, vagas: 1, ocupadas: 2 }),
      ),
    ).toBe(true);
  });

  it("AD-016: dispensa em sessão privada recusada pelo banco; fim antes do início recusado", async () => {
    const base = { servicoId, inicio: amanha(11), fim: amanha(15) };
    expect(
      await falha(
        db()
          .insert(sessao)
          .values({ ...base, dispensaPreCadastro: true }),
      ),
    ).toBe(true);
    expect(
      await falha(
        db()
          .insert(sessao)
          .values({ ...base, visibilidade: "publica", dispensaPreCadastro: true }),
      ),
    ).toBe(false);
    expect(
      await falha(
        db()
          .insert(sessao)
          .values({ ...base, fim: amanha(10) }),
      ),
    ).toBe(true);
  });

  it("contrato: estados de sessao no banco são os do domínio", async () => {
    const r = await db().execute<{ v: string }>(sql`select unnest(enum_range(null::estado_sessao))::text as v`);
    const doDominio = new Set(TRANSICOES_SESSAO.flatMap((t) => [t.de, t.para]).filter((e) => /^[a-z]+$/.test(e)));
    expect(new Set(r.rows.map((l) => l.v))).toEqual(doDominio);
  });
});
