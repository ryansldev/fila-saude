// Configuração de uma sessão (RN-ENC-05, RN-PUB-03, AD-016, AD-038, INV-02).

import { falha, ok, type Resultado } from "./resultado.ts";
import type { ModoServico } from "./servico.ts";

export type Visibilidade = "publica" | "privada";

export type ConfigSessao = {
  vagas: number | null;
  visibilidade: Visibilidade;
  dispensaPreCadastro: boolean;
  profissional: string | null;
  estacoes: string[];
};

export type ValidacaoSessao =
  | { ok: true }
  | { ok: false; erro: "servico_regulado" | "entrada_invalida"; campos?: Record<string, string> };

/**
 * Valida a configuração da sessão para o serviço. Erros de campo vêm juntos
 * (`entrada_invalida`); com os campos válidos, serviço regulado só aceita privada.
 */
export function validarSessao(
  servico: { modo: ModoServico; estacoesDoServico: string[] },
  c: ConfigSessao,
): ValidacaoSessao {
  const campos: Record<string, string> = {};
  if (c.vagas !== null && !(Number.isInteger(c.vagas) && c.vagas >= 1)) {
    campos.vagas = "vagas deve ser um inteiro maior ou igual a 1, ou vazio";
  }
  if (c.dispensaPreCadastro && c.visibilidade !== "publica") {
    campos.dispensaPreCadastro = "a dispensa de pré-cadastro só vale em sessão pública";
  }
  const fora = c.estacoes.filter((e) => !servico.estacoesDoServico.includes(e));
  if (fora.length > 0) {
    campos.estacoes = "a sessão só pode usar estações que atendem o serviço";
  }
  if (Object.keys(campos).length > 0) return { ok: false, erro: "entrada_invalida", campos };
  if (servico.modo === "regulado" && c.visibilidade === "publica") return { ok: false, erro: "servico_regulado" };
  return { ok: true };
}

/** RN-PUB-03: privada perde a dispensa; pública não é permitida em serviço regulado. */
export function mudarVisibilidade(c: ConfigSessao, para: Visibilidade, modo: ModoServico): Resultado<ConfigSessao> {
  if (para === "publica" && modo === "regulado") return falha("servico_regulado");
  if (para === "privada") return ok({ ...c, visibilidade: para, dispensaPreCadastro: false });
  return ok({ ...c, visibilidade: para });
}
