import { type EstadoItem, type EstadoSessao, TRANSICOES_ITEM, transicionar } from "./contratos.ts";
import { type ChaveOrdem, compararOrdem, type Risco } from "./ordem.ts";
import { expirada, type PrioridadeLegal, temPrioridade } from "./prioridade.ts";
import { type Evento, falha, ok, type Resultado } from "./resultado.ts";
import type { ConfigUnidade } from "./tipos.ts";

export type Etapa = "triagem" | "atendimento";

/** O que bloqueia o check-in (RN-FILA-05): só a recepção resolve. */
export type Pendencia = "conta" | "pessoa_atendida" | "pre_cadastro" | "prioridade";

export type ItemFila = {
  id: string;
  entradaId: string;
  senha: string;
  numero: number;
  etapa: Etapa;
  estado: EstadoItem;
  pendencias: Pendencia[];
  urgenciaConfirmada: boolean;
  risco: Risco;
  prioridade: PrioridadeLegal;
  pulos: number;
  travadoAtras: string[];
  saiuEm: number | null;
  atendidoEmEtapas: Etapa[];
};

export type Estacao = { id: string; etapa: Etapa; servicos: string[]; aberta: boolean; chamadoItemId: string | null };

export type Chamada = { itemId: string; etapa: Etapa; estacaoId: string; em: number };

export type DiaSessao = {
  sessaoId: string;
  /** Serviço da sessão: a estação só chama se o atende. */
  servicoId: string;
  estado: EstadoSessao;
  itens: ItemFila[];
  chamadas: Chamada[];
  /** "Saia de casa" já enviados (RN-ETA-03): um por item e etapa; o estado carrega, o domínio não memoriza. */
  avisosSaiaDeCasa: { itemId: string; etapa: Etapa }[];
  /** Tempo médio inicial por etapa (RN-ETA-05), quando difere do padrão da unidade (ex.: triagem mais curta). */
  tempoInicialMin?: Partial<Record<Etapa, number>>;
  estacoes: Estacao[];
  config: ConfigUnidade;
  /** Períodos de contingência registrados (RN-CONT-02), com o motivo. */
  contingencias: { inicio: number; fim: number; motivo?: string }[];
  proximoNumero: number;
  /** Prefixo de senha do serviço (RN-FILA-04), ex.: "C" → "C-001". */
  prefixoSenha: string;
  /** Serviço com triagem: quem entra começa na etapa de triagem (RN-TRI-01). */
  exigeTriagem: boolean;
  /**
   * Preenchido ao encerrar (RN-SES-02): hora, itens que levaram falta no encerramento (os que um
   * período de contingência registrado no mesmo dia pode apagar, RN-CONT-03) e a origem que o
   * remanejado recebe (RN-REM-03).
   */
  encerramento?: { em: number; faltas: string[]; origem: "privada" | "publica" | "regulada" };
};

export const CONFIG_PADRAO: ConfigUnidade = {
  fuso: "America/Sao_Paulo",
  janelaK: 1,
  toleranciaMin: 5,
  saiaDeCasaMin: 30,
  qrSegundos: 30,
  destaqueTvSegundos: 10,
  prazoConfirmacaoHoras: 24,
  tempoMedioInicialMin: 15,
  ordemMunicipio: "risco",
  alertaFaltas: { faltas: 2, dias: 90 },
  aindaPrecisa: { intervaloDias: 30, prazoDias: 7 },
  prazosPrioridade: {},
};

const chave = (i: ItemFila): ChaveOrdem => ({
  urgenciaConfirmada: i.urgenciaConfirmada,
  risco: i.risco,
  prioridade: i.prioridade,
  numero: i.numero,
});

/** < 0 quando `a` vem antes de `b` em ordem (RN-ORD, sem travas). */
const antes = (dia: DiaSessao, a: ItemFila, b: ItemFila): number =>
  compararOrdem(chave(a), chave(b), dia.config.ordemMunicipio);

/**
 * Ordem de chamada real: ordem(RN-ORD) do conjunto, e ninguém passa à frente de quem o trava
 * enquanto o travador está no conjunto (janela protegida). Sem candidato livre (não deveria
 * ocorrer), segue a ordem sem travas em vez de travar a fila (Review Focus 3).
 */
function ordemDeChamada(dia: DiaSessao, conjunto: ItemFila[]): ItemFila[] {
  const ordenados = [...conjunto].sort((a, b) => antes(dia, a, b));
  const noConjunto = new Set(ordenados.map((i) => i.id));
  const colocados: ItemFila[] = [];
  const feitos = new Set<string>();
  const livre = (i: ItemFila) =>
    i.urgenciaConfirmada || i.travadoAtras.every((t) => !noConjunto.has(t) || feitos.has(t));
  while (colocados.length < ordenados.length) {
    const proximo = ordenados.find((i) => !feitos.has(i.id) && livre(i)) ?? ordenados.find((i) => !feitos.has(i.id));
    if (!proximo) break;
    colocados.push(proximo);
    feitos.add(proximo.id);
  }
  return colocados;
}

/** Presentes da etapa que a estação atende, dos serviços dela, em ordem de chamada com a janela protegida. */
export function elegiveis(dia: DiaSessao, estacaoId: string): ItemFila[] {
  const estacao = dia.estacoes.find((e) => e.id === estacaoId);
  if (!estacao?.servicos.includes(dia.servicoId)) return [];
  return ordemDeChamada(
    dia,
    dia.itens.filter((i) => i.estado === "presente" && i.etapa === estacao.etapa),
  );
}

/** A hora `em` cai num período de contingência registrado (AD-033). */
export const emContingencia = (dia: DiaSessao, em: number): boolean =>
  dia.contingencias.some((c) => em >= c.inicio && em <= c.fim);

/**
 * Chamadas que fazem a vez de X passar (AD-010): nesta etapa, de alguém que vem depois de X em
 * ordem. Só contam as feitas enquanto X estava remoto: depois de "Vou sair" ou do 2º pulo, as
 * anteriores a `saiuEm` saem; sem `saiuEm`, X nunca esteve presente nesta etapa, e todas as
 * chamadas dela foram feitas com ele fora. Não filtra contingência: quem usa decide (AD-033).
 */
export function chamadasQuePassamAVez(dia: DiaSessao, x: ItemFila): Chamada[] {
  return dia.chamadas.filter((c) => {
    if (c.etapa !== x.etapa || c.itemId === x.id) return false;
    if (x.saiuEm !== null && c.em < x.saiuEm) return false;
    const chamado = dia.itens.find((i) => i.id === c.itemId);
    return chamado !== undefined && antes(dia, x, chamado) < 0;
  });
}

/**
 * Atraso (AD-010, AD-033): a vez de X passou por uma chamada fora de contingência.
 * Quem fica elegível estando na unidade (1º pulo, triagem → atendimento) não passa por aqui.
 */
function aVezPassou(dia: DiaSessao, x: ItemFila): boolean {
  return chamadasQuePassamAVez(dia, x).some((c) => !emContingencia(dia, c.em));
}

/**
 * X fica elegível: trava X atrás dos K primeiros da ordem de chamada real (janela protegida) e,
 * com `aplicarAtraso`, aplica antes a regra de atraso. O atraso só vale para quem chega de fora
 * (check-in, presença pela recepção); no 1º pulo e na passagem da triagem ao atendimento a pessoa
 * estava na unidade, então não se aplica (RN-CHAM-03, RN-TRI-04). Urgência confirmada escapa dos dois.
 */
export function ficarElegivel(
  dia: DiaSessao,
  itemId: string,
  agora: number,
  opcoes: { aplicarAtraso: boolean },
): { estado: DiaSessao; eventos: Evento[] } {
  const x = dia.itens.find((i) => i.id === itemId);
  if (!x) return { estado: dia, eventos: [] };
  const perdeuAVez = opcoes.aplicarAtraso && !x.urgenciaConfirmada && aVezPassou(dia, x);
  const travadoAtras = x.urgenciaConfirmada
    ? []
    : ordemDeChamada(
        dia,
        dia.itens.filter((i) => i.id !== x.id && i.estado === "presente" && i.etapa === x.etapa),
      )
        .slice(0, dia.config.janelaK)
        .map((i) => i.id);
  const numero = perdeuAVez ? dia.proximoNumero : x.numero;
  const novo: ItemFila = { ...x, estado: "presente", numero, travadoAtras, saiuEm: null };
  return {
    estado: {
      ...dia,
      itens: dia.itens.map((i) => (i.id === x.id ? novo : i)),
      proximoNumero: perdeuAVez ? dia.proximoNumero + 1 : dia.proximoNumero,
    },
    eventos: [
      {
        tipo: "presente",
        itemId: x.id,
        entradaId: x.entradaId,
        sessaoId: dia.sessaoId,
        dados: { numero, perdeuAVez, em: agora },
      },
    ],
  };
}

/**
 * Pendências que bloqueiam o check-in (RN-FILA-05). Prioridade declarada e não conferida,
 * ou conferida e vencida, conta como "prioridade" mesmo que não esteja na lista.
 */
function pendenciasEfetivas(dia: DiaSessao, item: ItemFila, agora: number): Pendencia[] {
  const p = item.prioridade;
  const prioridadePendente = temPrioridade(p) && (!p.conferida || expirada(p, agora, dia.config.prazosPrioridade));
  return prioridadePendente && !item.pendencias.includes("prioridade")
    ? [...item.pendencias, "prioridade"]
    : item.pendencias;
}

type Localizado = { ok: true; item: ItemFila } | { ok: false; erro: "sessao_fechada" | "transicao_proibida" };

/** Sessão aberta, item existe e o contrato permite o evento a partir do estado dele. */
function localizar(dia: DiaSessao, itemId: string, evento: string, para: EstadoItem): Localizado {
  if (dia.estado !== "aberta") return { ok: false, erro: "sessao_fechada" };
  const item = dia.itens.find((i) => i.id === itemId);
  if (!item || transicionar(TRANSICOES_ITEM, item.estado, evento) !== para) {
    return { ok: false, erro: "transicao_proibida" };
  }
  return { ok: true, item };
}

function marcarPresenca(dia: DiaSessao, itemId: string, agora: number): Resultado<DiaSessao> {
  const achado = localizar(dia, itemId, "QR válido ou recepção marca", "presente");
  if (!achado.ok) return falha(achado.erro);
  // Contrato: "QR válido" com pendência fica no mesmo estado; o check-in é recusado.
  if (pendenciasEfetivas(dia, achado.item, agora).length > 0) return falha("pendencia");
  const { estado, eventos } = ficarElegivel(dia, itemId, agora, { aplicarAtraso: true });
  return ok(estado, eventos);
}

/** RN-PRES-01: QR válido (a validade do token é da Task de QR). Com pendência, recusa (RN-FILA-05). */
export function checkIn(dia: DiaSessao, cmd: { itemId: string }, agora: number): Resultado<DiaSessao> {
  return marcarPresenca(dia, cmd.itemId, agora);
}

/** RN-PRES-03: a recepção marca presença, como no check-in; com pendência, use `conferirEMarcar`. */
export function marcarPresencaSemApp(dia: DiaSessao, cmd: { itemId: string }, agora: number): Resultado<DiaSessao> {
  return marcarPresenca(dia, cmd.itemId, agora);
}

const EVENTO_CONFERENCIA = {
  confere: "Recepção confere e marca presença (inclui pessoa sem app)",
  prioridade_nao_confere: "Recepção confere a identidade, mas não a prioridade, e marca presença",
  nao_confere: 'Recepção recusa ("não conferiu"), com motivo',
} as const;

/**
 * RN-FILA-05: a recepção confere e, na mesma ação, marca a presença (o atraso conta a partir daqui).
 * "nao_confere" tira da fila sem falta e sem remanejamento; a entrada é cancelada pelo chamador.
 */
export function conferirEMarcar(
  dia: DiaSessao,
  cmd: { itemId: string; resultado: "confere" | "nao_confere" | "prioridade_nao_confere"; motivo?: string },
  agora: number,
): Resultado<DiaSessao> {
  const para = cmd.resultado === "nao_confere" ? "saiu_da_fila" : "presente";
  const achado = localizar(dia, cmd.itemId, EVENTO_CONFERENCIA[cmd.resultado], para);
  if (!achado.ok) return falha(achado.erro);
  const item = achado.item;
  const base = { itemId: item.id, entradaId: item.entradaId };

  if (cmd.resultado === "nao_confere") {
    const saiu: ItemFila = { ...item, estado: "saiu_da_fila", travadoAtras: [] };
    return ok({ ...dia, itens: dia.itens.map((i) => (i.id === item.id ? saiu : i)) }, [
      { tipo: "nao_conferiu", ...base, ...(cmd.motivo === undefined ? {} : { motivo: cmd.motivo }) },
    ]);
  }

  const tinhaPendencia = pendenciasEfetivas(dia, item, agora).length > 0;
  const prioridade: PrioridadeLegal =
    cmd.resultado === "prioridade_nao_confere"
      ? { grupos: [], conferida: false, conferidaEm: null }
      : temPrioridade(item.prioridade)
        ? { ...item.prioridade, conferida: true, conferidaEm: agora }
        : item.prioridade;
  const conferido: ItemFila = { ...item, pendencias: [], prioridade };
  const eventos: Evento[] = [];
  if (cmd.resultado === "prioridade_nao_confere") eventos.push({ tipo: "prioridade_retirada", ...base });
  if (tinhaPendencia) eventos.push({ tipo: "pendencia_resolvida", ...base });
  const marcado = ficarElegivel(
    { ...dia, itens: dia.itens.map((i) => (i.id === item.id ? conferido : i)) },
    item.id,
    agora,
    { aplicarAtraso: true },
  );
  return ok(marcado.estado, [...eventos, ...marcado.eventos]);
}

/** RN-PRES-02: volta a remoto mantendo o número; quem sai não trava mais ninguém. */
export function vouSair(dia: DiaSessao, cmd: { itemId: string }, agora: number): Resultado<DiaSessao> {
  const item = dia.itens.find((i) => i.id === cmd.itemId);
  if (!item || transicionar(TRANSICOES_ITEM, item.estado, 'Paciente toca "Vou sair"') !== "remoto") {
    return falha("transicao_proibida");
  }
  const itens = dia.itens.map((i) =>
    i.id === item.id
      ? { ...i, estado: "remoto" as const, saiuEm: agora, travadoAtras: [] }
      : { ...i, travadoAtras: i.travadoAtras.filter((t) => t !== item.id) },
  );
  return ok({ ...dia, itens }, [{ tipo: "saiu", itemId: item.id, entradaId: item.entradaId, sessaoId: dia.sessaoId }]);
}
