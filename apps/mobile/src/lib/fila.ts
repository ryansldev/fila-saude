import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import type { Tom } from "@/components/ui";
import type { Situacao } from "./textos";

export type IdDoPasso = "inscricao" | "casa" | "unidade" | "triagem" | "atendimento";
/** `pendente`: é a etapa de agora, mas ainda não começou (a fila não abriu). */
export type EstadoDoPasso = "feito" | "atual" | "pendente" | "futuro";
export type Passo = { id: IdDoPasso; titulo: string; estado: EstadoDoPasso };

const TITULOS: Record<IdDoPasso, string> = {
  inscricao: "inscrição feita",
  casa: "esperando em casa",
  unidade: "na unidade",
  triagem: "triagem",
  atendimento: "atendimento",
};

const SEM_LINHA: Situacao["tipo"][] = ["cancelada", "saiu", "encaminhado", "remanejada"];
const ANTES_DA_FILA: Situacao["tipo"][] = ["confirmada", "aguardando", "atrasada", "alocada"];

/**
 * Linha do tempo da tela da fila: as etapas pelas quais a pessoa passa hoje, com a de agora em
 * destaque. A triagem só aparece no serviço que tem triagem (RN-TRI-01); depois dela, a etapa de
 * agora é o atendimento, mesmo se a pessoa foi esperar em casa (RN-TRI-05). Quem terminou sem
 * atendimento não tem linha do tempo.
 */
export function passosDaFila(en: MinhaEntrada, sit: Situacao): Passo[] {
  if (SEM_LINHA.includes(sit.tipo)) return [];
  const temTriagem = en.etapa === "triagem" || en.triado;
  const ids: IdDoPasso[] = ["inscricao", "casa", "unidade", ...(temTriagem ? ["triagem" as const] : []), "atendimento"];
  const indice = (id: IdDoPasso) => ids.indexOf(id);

  let atual: number;
  let pendente = false;
  if (sit.tipo === "concluida") atual = ids.length;
  else if (sit.tipo === "lista" || sit.tipo === "reserva") {
    atual = indice("inscricao");
    pendente = true;
  } else if (ANTES_DA_FILA.includes(sit.tipo)) {
    atual = indice("casa");
    pendente = true;
  } else if (sit.tipo === "vez") atual = indice(en.etapa === "triagem" ? "triagem" : "atendimento");
  else if (en.triado) atual = indice("atendimento");
  else if ((sit.tipo === "posicao" || sit.tipo === "sem_previsao") && sit.presente) atual = indice("unidade");
  else atual = indice("casa");

  return ids.map((id, i) => ({
    id,
    titulo: TITULOS[id],
    estado: i < atual ? "feito" : i === atual ? (pendente ? "pendente" : "atual") : "futuro",
  }));
}

export type DestaqueDaFila = {
  tom: Tom;
  rotulo: string;
  senha: string | null;
  posicao?: number;
  minutos?: number;
  sala?: string;
};

/** O topo da tela da fila: a senha bem grande e, na fila, a posição e o tempo. */
export function destaqueDaFila(en: MinhaEntrada, sit: Situacao): DestaqueDaFila {
  const senha = en.senha;
  switch (sit.tipo) {
    case "vez":
      return {
        tom: "verde",
        rotulo: "é a sua vez!",
        senha: sit.senha,
        sala: sit.estacao?.toLowerCase() ?? "veja a sala na TV",
      };
    case "venha":
      return { tom: "amarelo", rotulo: "venha agora", senha };
    case "recepcao":
      return { tom: "amarelo", rotulo: "mostre na recepção", senha };
    case "posicao":
      return { tom: "azul", rotulo: "sua senha", senha, posicao: sit.posicao, minutos: sit.minutos };
    case "sem_previsao":
      return { tom: "azul", rotulo: "sua senha", senha };
    case "concluida":
      return { tom: "verde", rotulo: "atendimento concluído", senha };
    case "encaminhado":
      return { tom: "vermelho", rotulo: "encaminhado à emergência", senha };
    case "saiu":
      return { tom: "vermelho", rotulo: "você saiu da fila", senha };
    case "cancelada":
      return { tom: "cinza", rotulo: "inscrição cancelada", senha: null };
    case "remanejada":
      return { tom: "cinza", rotulo: "a unidade vai marcar outra data", senha: null };
    default:
      return { tom: "cinza", rotulo: "a senha sai quando a fila abrir", senha: null };
  }
}
