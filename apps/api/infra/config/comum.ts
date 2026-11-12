import type { Acao } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";

export const UNIDADES_E_REGRAS: Acao = "criar_unidades_e_regras";
export const EQUIPE: Acao = "cadastrar_equipe";
export const CONFIGURAR: Acao = "configurar_servicos_sessoes_estacoes_tv";
export const SESSAO: Acao = "abrir_cancelar_encerrar_sessao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Id do caminho; fora do formato é o mesmo 404 de um id que não existe.
export function idDoCaminho(req: FastifyRequest, nome: string): string {
  const id = (req.params as Record<string, unknown>)[nome];
  if (typeof id !== "string" || !UUID.test(id)) throw new ErroApi(404, "nao_encontrado");
  return id;
}

export async function exigirUnidade(db: BancoDoTenant, id: string) {
  const [u] = await db.select().from(unidade).where(eq(unidade.id, id));
  if (!u) throw new ErroApi(404, "nao_encontrado");
  return u;
}
