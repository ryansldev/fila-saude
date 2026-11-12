import { type Atribuicoes, podeCadastrar, problemasDaEquipe } from "@fila-saude/domain";
import type { AtribuicoesEntrada, UsuarioPainel, UsuarioPainelEntrada } from "@fila-saude/schemas/usuario";
import { asc, eq, inArray } from "drizzle-orm";
import { criarUsuarioPainel } from "infra/auth/painel";
import { usuarioPainel } from "infra/database/municipal/schema/auth";
import { funcaoUsuario } from "infra/database/municipal/schema/equipe";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { atribuicoesDoUsuario, concederAtribuicoes, substituirAtribuicoes } from "infra/painel/perfis";
import { EQUIPE } from "./comum";

const RESSALVA_GERENTE = "da própria unidade, sem função de gestão";

// Forma (escopo de cada função, ao menos uma atribuição) e unidades existentes no tenant.
async function validarAtribuicoes(db: BancoDoTenant, a: AtribuicoesEntrada): Promise<Atribuicoes> {
  const campos: Record<string, string[]> = Object.fromEntries(
    Object.entries(problemasDaEquipe(a)).map(([k, v]) => [k, [v]]),
  );
  const ids = [
    ...new Set([...a.vinculos.map((v) => v.unidadeId), ...a.funcoes.map((f) => f.unidadeId)].filter((x) => x !== null)),
  ] as string[];
  if (ids.length > 0) {
    const achadas = new Set(
      (await db.select({ id: unidade.id }).from(unidade).where(inArray(unidade.id, ids))).map((u) => u.id),
    );
    a.vinculos.forEach((v, i) => {
      if (!achadas.has(v.unidadeId)) campos[`vinculos.${i}.unidadeId`] = ["unidade não encontrada"];
    });
    a.funcoes.forEach((f, i) => {
      if (f.unidadeId && !achadas.has(f.unidadeId)) campos[`funcoes.${i}.unidadeId`] = ["unidade não encontrada"];
    });
  }
  if (Object.keys(campos).length > 0) throw new ErroApi(400, "entrada_invalida", campos);
  return a;
}

// A unidade em que o guard confere o gerente: a primeira com atribuição; sem nenhuma, só o município conta.
function unidadeDoAlvo(...alvos: Atribuicoes[]): string | null {
  for (const a of alvos) {
    const u = a.vinculos[0]?.unidadeId ?? a.funcoes.find((f) => f.unidadeId)?.unidadeId;
    if (u) return u;
  }
  return null;
}

async function usuarioComAtribuicoes(db: BancoDoTenant, id: string): Promise<UsuarioPainel> {
  const [u] = await db.select().from(usuarioPainel).where(eq(usuarioPainel.id, id));
  if (!u) throw new ErroApi(404, "nao_encontrado");
  return { id: u.id, login: u.username ?? "", nome: u.name, ...(await atribuicoesDoUsuario(db, id)) };
}

// RN-PERF-04: quem cria quem passa pela matriz (gestão SMS livre; gerente com a ressalva) e por `podeCadastrar`.
export async function criarUsuario(ctx: ContextoDaAcao, dados: UsuarioPainelEntrada): Promise<UsuarioPainel> {
  const alvo = await validarAtribuicoes(ctx.db, dados);
  const ator = await atribuicoesDoUsuario(ctx.db, ctx.ator.usuarioId);
  return executarAcao(
    ctx,
    {
      acao: EQUIPE,
      alvo: { tipo: "usuario", id: (u) => u.id },
      unidadeId: unidadeDoAlvo(alvo),
      ressalvas: { [RESSALVA_GERENTE]: () => podeCadastrar(ator, alvo) },
      dados: (u) => ({ vinculos: u.vinculos, funcoes: u.funcoes }),
    },
    async (tx) => {
      if (!podeCadastrar(ator, alvo)) throw new ErroApi(403, "sem_permissao");
      const { id } = await criarUsuarioPainel(tx, { login: dados.login, nome: dados.nome, senha: dados.senha });
      await concederAtribuicoes(tx, id, alvo, ctx.ator.usuarioId);
      return usuarioComAtribuicoes(tx, id);
    },
  );
}

// Gestão SMS vê todos; o gerente, quem tem alguma atribuição nas unidades dele; os outros, ninguém.
export async function listarUsuarios(ctx: ContextoDaAcao): Promise<UsuarioPainel[]> {
  const ator = await atribuicoesDoUsuario(ctx.db, ctx.ator.usuarioId);
  const sms = ator.funcoes.some((f) => f.funcao === "gestao_sms");
  const gerencia = new Set(ator.funcoes.filter((f) => f.funcao === "gerente_ubs").map((f) => f.unidadeId));
  if (!sms && gerencia.size === 0) throw new ErroApi(403, "sem_permissao");
  const usuarios = await ctx.db.select().from(usuarioPainel).orderBy(asc(usuarioPainel.createdAt));
  const todos = await Promise.all(usuarios.map((u) => usuarioComAtribuicoes(ctx.db, u.id)));
  if (sms) return todos;
  return todos.filter(
    (u) => u.vinculos.some((v) => gerencia.has(v.unidadeId)) || u.funcoes.some((f) => gerencia.has(f.unidadeId)),
  );
}

// RN-PERF-04: o ator precisa poder cadastrar a pessoa como ela está e como vai ficar.
export async function trocarAtribuicoes(
  ctx: ContextoDaAcao,
  usuarioId: string,
  novas: AtribuicoesEntrada,
): Promise<UsuarioPainel> {
  const atual = await usuarioComAtribuicoes(ctx.db, usuarioId);
  const alvo = await validarAtribuicoes(ctx.db, novas);
  const ator = await atribuicoesDoUsuario(ctx.db, ctx.ator.usuarioId);
  const pode = () => podeCadastrar(ator, atual) && podeCadastrar(ator, alvo);
  return executarAcao(
    ctx,
    {
      acao: EQUIPE,
      alvo: { tipo: "usuario", id: usuarioId },
      unidadeId: unidadeDoAlvo(atual, alvo),
      ressalvas: { [RESSALVA_GERENTE]: pode },
      dados: (u) => ({ vinculos: u.vinculos, funcoes: u.funcoes }),
    },
    async (tx) => {
      if (!pode()) throw new ErroApi(403, "sem_permissao");
      const eraSms = atual.funcoes.some((f) => f.funcao === "gestao_sms");
      if (eraSms && !alvo.funcoes.some((f) => f.funcao === "gestao_sms")) {
        const sms = await tx
          .selectDistinct({ id: funcaoUsuario.usuarioId })
          .from(funcaoUsuario)
          .where(eq(funcaoUsuario.funcao, "gestao_sms"));
        if (sms.length <= 1) throw new ErroApi(409, "ultimo_gestor");
      }
      await substituirAtribuicoes(tx, usuarioId, alvo, ctx.ator.usuarioId);
      return usuarioComAtribuicoes(tx, usuarioId);
    },
  );
}
