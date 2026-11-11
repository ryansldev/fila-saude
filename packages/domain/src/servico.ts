// Mudanças de configuração do serviço (RN-ENC-05, RN-ENC-07, RN-TRI-01, AD-038).

import {
  type EstadoEntrada,
  type EstadoSessao,
  TRANSICOES_ENTRADA,
  type Transicao,
  transicaoUnica,
} from "./contratos.ts";
import { falha, ok, type Resultado } from "./resultado.ts";

export type ModoServico = "livre" | "requisicao" | "regulado";

type EntradaDoServico = { id: string; estado: EstadoEntrada; vagaSegura: boolean; sessaoAbriu: boolean };
type Mudanca = { id: string; para: EstadoEntrada; push: boolean };

const NAO_ATIVAS: EstadoEntrada[] = ["concluida", "cancelada", "encerrada_sem_atendimento", "arquivada"];

const EVENTO_REGULADO = 'Serviço muda para "regulado"';
const EVENTO_LIVRE = 'Serviço muda para "livre"';
const QUALIFICADOR_VAGA_SEGURA = "vaga segura";

/** RN-TRI-01: "exige triagem" só muda sem sessão aberta do serviço. */
export function podeMudarExigeTriagem(sessoesDoServico: { estado: EstadoSessao }[]): boolean {
  return !sessoesDoServico.some((s) => s.estado === "aberta");
}

/** RN-ENC-07: entradas que bloqueiam a troca para "regulado" (não finais e não arquivadas). */
export function contarAtivas(entradas: { estado: EstadoEntrada }[]): number {
  return entradas.filter((e) => !NAO_ATIVAS.includes(e.estado)).length;
}

/** A mudança que a linha do contrato manda fazer; `null` se a linha falta ou não muda de estado. */
function mudancaDaLinha(id: string, linha: Transicao<EstadoEntrada> | null): Mudanca | null {
  if (!linha || linha.para === "(mesmo)" || linha.para === "(não cria)") return null;
  return { id, para: linha.para, push: linha.efeitos.includes("Push") };
}

/**
 * Linha do contrato para "Serviço muda para livre" a partir de "aguardando encaminhamento".
 * A linha qualificada "vaga segura" tem a condição "Antes da abertura" (Confirmada, push):
 * vale só com vaga segura e sessão ainda não aberta; senão, a linha sem qualificador.
 */
function linhaAoVirarLivre(e: EntradaDoServico): Transicao<EstadoEntrada> | null {
  const qualificada = e.vagaSegura && !e.sessaoAbriu;
  return transicaoUnica(TRANSICOES_ENTRADA, e.estado, EVENTO_LIVRE, (t) =>
    qualificada ? t.qualificador === QUALIFICADOR_VAGA_SEGURA : t.qualificador === undefined,
  );
}

/**
 * RN-ENC-07 / AD-038: efeitos da troca de modo sobre as entradas do serviço.
 * Não altera as entradas recebidas; devolve as mudanças a aplicar.
 */
export function mudarModoServico(
  de: ModoServico,
  para: ModoServico,
  entradas: EntradaDoServico[],
): Resultado<{ mudancas: Mudanca[] }> {
  const mudancas: Mudanca[] = [];
  if (de === para) return ok({ mudancas });

  if (para === "regulado") {
    if (contarAtivas(entradas) > 0) return falha("servico_regulado");
    for (const e of entradas) {
      if (e.estado !== "arquivada") continue;
      const mudanca = mudancaDaLinha(e.id, transicaoUnica(TRANSICOES_ENTRADA, e.estado, EVENTO_REGULADO));
      if (!mudanca) return falha("transicao_proibida");
      mudancas.push(mudanca);
    }
    return ok({ mudancas });
  }

  if (de === "requisicao" && para === "livre") {
    for (const e of entradas) {
      if (e.estado !== "aguardando_encaminhamento") continue;
      const mudanca = mudancaDaLinha(e.id, linhaAoVirarLivre(e));
      if (!mudanca) return falha("transicao_proibida");
      mudancas.push(mudanca);
    }
  }

  // livre → requisição (AD-038) e saída de "regulado": nada muda.
  return ok({ mudancas });
}
