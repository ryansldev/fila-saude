import { eq } from "drizzle-orm";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { contextoDoUsuario, executarAcao } from "infra/painel/acao";
import orchestrator from "tests/orchestrator";
import { ocupacao } from "tests/painel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;
let b: string;
let gestorId: string;
let unidadeId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  const m = await orchestrator.criarMunicipio();
  a = m.slug;
  gestorId = m.gestorId as string;
  ({ slug: b } = await orchestrator.criarMunicipio());
  unidadeId = await orchestrator.criarUnidadeDireto(a);
});
afterAll(() => orchestrator.derrubarMunicipios());

const db = () => orchestrator.bancoDoMunicipio(a);
const gravarPessoa =
  (nome: string) => async (tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0]) => {
    const [p] = await tx.insert(pessoaLocal).values({ nome, nascimento: "1990-01-01" }).returning();
    return p as { id: string };
  };

describe("executarAcao", () => {
  it("INV-12: ação grava uma auditoria com quem, o quê, quando e alvo", async () => {
    const ctx = await contextoDoUsuario(db(), gestorId, Date.now());
    const p = await executarAcao(
      ctx,
      { acao: "criar_unidades_e_regras", alvo: { tipo: "pessoa", id: (r) => r.id } },
      gravarPessoa("Auditada"),
    );
    const linhas = await db().select().from(auditoria).where(eq(auditoria.alvoId, p.id));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      usuarioId: gestorId,
      acao: "criar_unidades_e_regras",
      alvoTipo: "pessoa",
    });
  });

  it("INV-12: ação que falha depois de gravar não deixa nem o dado nem a auditoria", async () => {
    const ctx = await contextoDoUsuario(db(), gestorId, Date.now());
    const antes = (await db().select().from(auditoria)).length;
    await expect(
      executarAcao(ctx, { acao: "criar_unidades_e_regras", alvo: { tipo: "pessoa", id: "x" } }, async (tx) => {
        await gravarPessoa("Fantasma")(tx);
        throw new Error("falhou depois");
      }),
    ).rejects.toThrow("falhou depois");
    expect(await db().select().from(pessoaLocal).where(eq(pessoaLocal.nome, "Fantasma"))).toHaveLength(0);
    expect((await db().select().from(auditoria)).length).toBe(antes);
  });

  it("RN-PERF-03: sem motivo → 400 motivo_obrigatorio", async () => {
    const ctx = await contextoDoUsuario(db(), gestorId, Date.now());
    await expect(
      executarAcao(
        ctx,
        { acao: "criar_unidades_e_regras", alvo: { tipo: "pessoa", id: "x" }, exigeMotivo: true },
        gravarPessoa("SemMotivo"),
      ),
    ).rejects.toMatchObject({ status: 400, codigo: "motivo_obrigatorio" });
  });

  it("PD-41: fora do HTTP confere a permissão do usuário — profissional na ação de gestão → 403", async () => {
    const u = await orchestrator.criarUsuarioComPerfis(a, "prof", ocupacao(unidadeId, "medico"));
    const ctx = await contextoDoUsuario(db(), u.id, Date.now());
    const antes = (await db().select().from(auditoria)).length;
    await expect(
      executarAcao(ctx, { acao: "criar_unidades_e_regras", alvo: { tipo: "pessoa", id: "x" } }, gravarPessoa("Nao")),
    ).rejects.toMatchObject({ status: 403, codigo: "sem_permissao" });
    expect((await db().select().from(auditoria)).length).toBe(antes);
  });

  it("auditoria de A não aparece em B", async () => {
    expect(await orchestrator.bancoDoMunicipio(b).select().from(auditoria)).toHaveLength(0);
  });
});
