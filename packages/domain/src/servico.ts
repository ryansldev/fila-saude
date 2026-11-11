// Mudanças de configuração do serviço (RN-ENC-05, RN-ENC-07, RN-TRI-01, AD-038).

import { type EstadoEntrada, type EstadoSessao, TRANSICOES_ENTRADA, transicionar } from "./contratos.ts";
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

/**
 * Linha do contrato para "Serviço muda para livre" a partir de "aguardando encaminhamento":
 * com vaga segura e antes da abertura, a linha qualificada (Confirmada, push); senão, a sem qualificador.
 */
function destinoAoVirarLivre(e: EntradaDoServico): { para: EstadoEntrada | "(mesmo)" | null; push: boolean } {
  const qualificada = e.vagaSegura && !e.sessaoAbriu;
  const linhas = TRANSICOES_ENTRADA.filter(
    (t) =>
      t.de === e.estado &&
      t.evento === EVENTO_LIVRE &&
      (qualificada ? t.qualificador === QUALIFICADOR_VAGA_SEGURA : t.qualificador === undefined),
  );
  const [linha] = linhas;
  if (!linha || linhas.length > 1) return { para: null, push: false };
  return { para: linha.para === "(não cria)" ? null : linha.para, push: linha.efeitos.includes("Push") };
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
      const destino = transicionar(TRANSICOES_ENTRADA, e.estado, EVENTO_REGULADO);
      if (destino === null || destino === "(mesmo)") return falha("transicao_proibida");
      mudancas.push({ id: e.id, para: destino, push: true });
    }
    return ok({ mudancas });
  }

  if (de === "requisicao" && para === "livre") {
    for (const e of entradas) {
      if (e.estado !== "aguardando_encaminhamento") continue;
      const { para: destino, push } = destinoAoVirarLivre(e);
      if (destino === null || destino === "(mesmo)") return falha("transicao_proibida");
      mudancas.push({ id: e.id, para: destino, push });
    }
  }

  // livre → requisição (AD-038) e saída de "regulado": nada muda.
  return ok({ mudancas });
}
