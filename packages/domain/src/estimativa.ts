import { aVezPassou, type DiaSessao, type Etapa, elegiveis, type ItemFila } from "./fila.ts";
import { compararOrdem } from "./ordem.ts";
import type { Evento } from "./resultado.ts";

const MIN = 60_000;

export type Estimativa =
  | { tipo: "posicao"; posicao: number; minutos: number; consulta?: { minutos: number } }
  | { tipo: "venha_agora"; consulta?: { minutos: number } }
  | { tipo: "aguardando_inicio" }
  | { tipo: "modo_manual" }
  /** Chamado agora numa estação: o app mostra a chamada, não uma posição. */
  | { tipo: "chamado" }
  /** Atendido, fora da fila, remanejado, ou sessão encerrada/cancelada: sem estimativa. */
  | { tipo: "fora_da_fila" };

type Opcoes = { modoManual: boolean };

const mediana = (ordenados: number[]): number => {
  const m = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? (ordenados[m] as number)
    : ((ordenados[m - 1] as number) + (ordenados[m] as number)) / 2;
};

const inicial = (dia: DiaSessao, etapa: Etapa): number =>
  dia.tempoInicialMin?.[etapa] ?? dia.config.tempoMedioInicialMin;

/**
 * RN-ETA-05: duração = da chamada até a próxima chamada na mesma estação (a última de cada estação
 * não entra). Últimos 10 da etapa, sem os fora da curva (< 1/3 ou > 3× a mediana); média dos que
 * sobram, ou o tempo inicial se forem menos de 3. Só vale para o serviço da sessão.
 */
export function tempoMedio(dia: DiaSessao, etapa: Etapa, servicoId: string, agora: number): number {
  if (servicoId !== dia.servicoId) return inicial(dia, etapa);
  const porEstacao = new Map<string, { em: number; pulo: boolean }[]>();
  for (const c of dia.chamadas) {
    if (c.etapa !== etapa || c.em > agora) continue;
    porEstacao.set(c.estacaoId, [...(porEstacao.get(c.estacaoId) ?? []), { em: c.em, pulo: Boolean(c.naoCompareceu) }]);
  }
  const duracoes: { fim: number; min: number }[] = [];
  for (const tempos of porEstacao.values()) {
    const ordenados = [...tempos].sort((a, b) => a.em - b.em);
    ordenados.forEach((inicio, k) => {
      const proxima = ordenados[k + 1];
      // "Não compareceu" não é atendimento concluído (RN-ETA-05.2).
      if (proxima !== undefined && !inicio.pulo)
        duracoes.push({ fim: proxima.em, min: (proxima.em - inicio.em) / MIN });
    });
  }
  const ultimas = duracoes
    .sort((a, b) => a.fim - b.fim)
    .slice(-10)
    .map((d) => d.min);
  if (ultimas.length === 0) return inicial(dia, etapa);
  const med = mediana([...ultimas].sort((a, b) => a - b));
  const validas = ultimas.filter((m) => m >= med / 3 && m <= med * 3);
  if (validas.length < 3) return inicial(dia, etapa);
  return validas.reduce((s, m) => s + m, 0) / validas.length;
}

const abertas = (dia: DiaSessao, etapa: Etapa) =>
  dia.estacoes.filter((e) => e.aberta && e.etapa === etapa && e.servicos.includes(dia.servicoId));

const naFila = (i: ItemFila): boolean => i.estado === "remoto" || i.estado === "presente";

const ordem = (dia: DiaSessao, a: ItemFila, b: ItemFila): number =>
  compararOrdem(
    { urgenciaConfirmada: a.urgenciaConfirmada, risco: a.risco, prioridade: a.prioridade, numero: a.numero },
    { urgenciaConfirmada: b.urgenciaConfirmada, risco: b.risco, prioridade: b.prioridade, numero: b.numero },
    dia.config.ordemMunicipio,
  );

/**
 * RN-ETA-01/01b/01c/02/04 (AD-002, AD-003, AD-009) e RN-SES-05 (AD-043).
 * Presente: lugar na ordem de chamada real (janela protegida); remoto: quantos vêm antes em
 * ordem(todas), presentes e remotos. Quem está na triagem vê o tempo até a triagem e, à parte,
 * a previsão da consulta. Só quem espera (remoto ou presente) na sessão aberta tem posição:
 * sessão planejada aguarda o início; encerrada ou cancelada, ou item em estado final, está fora
 * da fila; chamado vê a chamada. Item inexistente é erro de programação: lança.
 */
export function estimar(dia: DiaSessao, itemId: string, agora: number, opcoes: Opcoes): Estimativa {
  const item = dia.itens.find((i) => i.id === itemId);
  if (!item) throw new Error(`item ${itemId} não existe`);
  if (dia.estado === "planejada") return { tipo: "aguardando_inicio" };
  if (dia.estado !== "aberta" || (!naFila(item) && item.estado !== "chamado")) return { tipo: "fora_da_fila" };
  if (item.estado === "chamado") return { tipo: "chamado" };
  if (opcoes.modoManual) return { tipo: "modo_manual" };

  const estacoes = abertas(dia, item.etapa);
  const n = estacoes.length;
  const primeira = estacoes[0];
  if (!primeira) return { tipo: "aguardando_inicio" };

  const naEtapa = dia.itens.filter((i) => naFila(i) && i.etapa === item.etapa);
  // AD-010: remoto cuja vez já passou vai para o fim ao chegar; não está "à frente" de ninguém e
  // não pode ouvir "venha agora" como se fosse o próximo.
  const passou = (i: ItemFila) => i.estado === "remoto" && !i.urgenciaConfirmada && aVezPassou(dia, i);
  const aFrente =
    item.estado === "presente"
      ? elegiveis(dia, primeira.id).findIndex((i) => i.id === item.id)
      : passou(item)
        ? naEtapa.filter((i) => i.id !== item.id && !passou(i)).length
        : naEtapa.filter((i) => ordem(dia, i, item) < 0 && !passou(i)).length;
  if (aFrente < 0) return { tipo: "aguardando_inicio" };
  const comeNow = item.estado === "remoto" && aFrente === 0;
  const minutos = Math.ceil((aFrente * tempoMedio(dia, item.etapa, dia.servicoId, agora)) / n);
  const principal: Estimativa = comeNow ? { tipo: "venha_agora" } : { tipo: "posicao", posicao: aFrente + 1, minutos };
  if (item.etapa !== "triagem") return principal;

  // RN-ETA-01c/AD-009: na triagem, a previsão da consulta vai à parte (inclusive com "venha agora").
  const nA = abertas(dia, "atendimento").length;
  if (nA === 0) return principal;
  const antesNaConsulta = dia.itens.filter((i) => naFila(i) && ordem(dia, i, item) < 0).length;
  const pesoTriagem = (aFrente * tempoMedio(dia, "triagem", dia.servicoId, agora)) / n;
  const consulta = Math.ceil(
    pesoTriagem + (antesNaConsulta * tempoMedio(dia, "atendimento", dia.servicoId, agora)) / nA,
  );
  return { ...principal, consulta: { minutos: consulta } };
}

/**
 * RN-ETA-03 (AD-009, AD-043): "saia de casa" para o remoto cujo tempo até a etapa atual caiu abaixo
 * do limite, uma vez por item e etapa. O que já foi enviado vive em `dia.avisosSaiaDeCasa`, então a
 * função devolve o novo dia junto com os eventos; em modo manual nada é enviado nem registrado.
 */
export function avisosSaiaDeCasa(dia: DiaSessao, agora: number, opcoes: Opcoes): { dia: DiaSessao; eventos: Evento[] } {
  if (opcoes.modoManual || dia.estado !== "aberta") return { dia, eventos: [] };
  const jaEnviado = (i: ItemFila) => dia.avisosSaiaDeCasa.some((a) => a.itemId === i.id && a.etapa === i.etapa);
  const novos: ItemFila[] = [];
  const eventos: Evento[] = [];
  for (const i of dia.itens) {
    if (i.estado !== "remoto" || jaEnviado(i)) continue;
    const e = estimar(dia, i.id, agora, opcoes);
    const minutos = e.tipo === "venha_agora" ? 0 : e.tipo === "posicao" ? e.minutos : null;
    if (minutos === null || minutos >= dia.config.saiaDeCasaMin) continue;
    novos.push(i);
    eventos.push({
      tipo: "saia_de_casa",
      itemId: i.id,
      entradaId: i.entradaId,
      sessaoId: dia.sessaoId,
      dados: { etapa: i.etapa, minutos, em: agora },
    });
  }
  if (novos.length === 0) return { dia, eventos };
  return {
    dia: {
      ...dia,
      avisosSaiaDeCasa: [...dia.avisosSaiaDeCasa, ...novos.map((i) => ({ itemId: i.id, etapa: i.etapa }))],
    },
    eventos,
  };
}
