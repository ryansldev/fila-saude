import { type ConfigParcial, configEfetiva, validarConfig } from "@fila-saude/domain";
import type { ConfigEfetivaSaida, Endereco, Unidade, UnidadeEdicao, UnidadeEntrada } from "@fila-saude/schemas/unidade";
import { asc, eq, inArray } from "drizzle-orm";
import { unidade } from "infra/database/municipal/schema/unidade";
import { camposDoDominio, ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { exigirUnidade, UNIDADES_E_REGRAS } from "./comum";

type Linha = typeof unidade.$inferSelect;

export function paraUnidade(u: Linha): Unidade {
  return {
    id: u.id,
    nome: u.nome,
    tipo: u.tipo,
    cnes: u.cnes,
    endereco: { cep: u.cep, logradouro: u.logradouro, numero: u.numero, complemento: u.complemento, bairro: u.bairro },
    lat: u.lat,
    lng: u.lng,
    fuso: u.fuso,
    horario: u.horario,
    config: u.config as Unidade["config"],
  };
}

// O endereço do contrato em colunas.
function colunasDoEndereco(e: Endereco) {
  return {
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento ?? null,
    bairro: e.bairro,
  };
}

function validar(config: ConfigParcial) {
  const r = validarConfig(config);
  if (!r.ok) {
    const campos = Object.fromEntries(Object.entries(camposDoDominio(r.campos)).map(([k, v]) => [`config.${k}`, v]));
    throw new ErroApi(400, "entrada_invalida", campos);
  }
}

// `null` num campo = remover a chave e voltar a herdar (PD-28).
function mesclar(atual: ConfigParcial, mudancas: Record<string, unknown>): ConfigParcial {
  const nova: Record<string, unknown> = { ...atual };
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === null) delete nova[k];
    else if (v !== undefined) nova[k] = v;
  }
  return nova as ConfigParcial;
}

// T2.2: só o gestor cria e edita unidades.
export async function criarUnidade(ctx: ContextoDaAcao, dados: UnidadeEntrada): Promise<Unidade> {
  const config = mesclar({}, dados.config ?? {});
  validar(config);
  return executarAcao(ctx, { acao: UNIDADES_E_REGRAS, alvo: { tipo: "unidade", id: (u) => u.id } }, async (tx) => {
    const { endereco, ...resto } = dados;
    const [u] = await tx
      .insert(unidade)
      .values({ ...resto, ...colunasDoEndereco(endereco), config })
      .returning();
    return paraUnidade(u as Linha);
  });
}

export async function editarUnidade(ctx: ContextoDaAcao, id: string, dados: UnidadeEdicao): Promise<Unidade> {
  const atual = await exigirUnidade(ctx.db, id);
  const config = mesclar(atual.config, dados.config ?? {});
  validar(config);
  const { config: _c, endereco, ...resto } = dados;
  return executarAcao(ctx, { acao: UNIDADES_E_REGRAS, alvo: { tipo: "unidade", id }, unidadeId: id }, async (tx) => {
    const [u] = await tx
      .update(unidade)
      .set({ ...resto, ...(endereco ? colunasDoEndereco(endereco) : {}), config })
      .where(eq(unidade.id, id))
      .returning();
    return paraUnidade(u as Linha);
  });
}

// Gestor (escopo município) vê todas; os outros, as unidades dos seus perfis.
export async function listarUnidades(ctx: ContextoDaAcao): Promise<Unidade[]> {
  const todas = ctx.ator.perfis.some((p) => p.unidadeId === null);
  const ids = ctx.ator.perfis.map((p) => p.unidadeId).filter((x): x is string => x !== null);
  if (!todas && ids.length === 0) return [];
  const q = ctx.db.select().from(unidade).orderBy(asc(unidade.criadoEm), asc(unidade.nome));
  const linhas = todas ? await q : await q.where(inArray(unidade.id, ids));
  return linhas.map(paraUnidade);
}

export async function lerUnidade(ctx: ContextoDaAcao, id: string): Promise<Unidade> {
  return paraUnidade(await exigirUnidade(ctx.db, id));
}

// PD-35: o nível município é `{}` na v0.1 e herda o padrão.
export async function configDaUnidade(ctx: ContextoDaAcao, id: string): Promise<ConfigEfetivaSaida> {
  const u = await exigirUnidade(ctx.db, id);
  const { origem, ...valores } = configEfetiva({ municipio: {}, unidade: u.config });
  return { valores, origem };
}

export function podeVerUnidade(ctx: ContextoDaAcao, id: string): boolean {
  return ctx.ator.perfis.some((p) => p.unidadeId === null || p.unidadeId === id);
}
