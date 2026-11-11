import { describe, expect, it } from "vitest";
import { chamarProximo, finalizar, naoCompareceu } from "../src/chamada.ts";
import {
  cancelar,
  desistir,
  encerrar,
  escolherData,
  type Origem,
  origemDaSessao,
  outraData,
  registrarContingencia,
  titularDaFalta,
} from "../src/encerramento.ts";
import { checkIn, type DiaSessao, vouSair } from "../src/fila.ts";
import { type Entrada, recusar, type Servico } from "../src/lista.ts";
import type { Resultado } from "../src/resultado.ts";
import { liberarVaga } from "../src/sessao.ts";
import { chamar, comItem, congelar, diaCom, entrada, sessaoVagas } from "./fixtures.ts";

const MIN = 60_000;
const H = 60 * MIN;
const DIA = 24 * H;
/** 13/11/2026 07:00 em Brasília: início da sessão "s1". */
const T = Date.UTC(2026, 10, 13, 10, 0);

const LIVRE: Servico = congelar({ id: "cli", modo: "livre", exigeTriagem: false });
const REQUISICAO: Servico = congelar({ id: "cli", modo: "requisicao", exigeTriagem: false });
const PRIVADA: Origem = "privada";

function aplicar<E>(r: Resultado<E>): E {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return congelar(r.estado);
}
const eventos = <E>(r: Resultado<E>) => {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return r.eventos;
};
const erro = <E>(r: Resultado<E>) => (r.ok ? "ok" : r.erro);

const item = (dia: DiaSessao, id: string) => {
  const i = dia.itens.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
};
const ent = (entradas: Entrada[], id: string) => {
  const e = entradas.find((x) => x.id === id);
  if (!e) throw new Error(`entrada ${id} não existe`);
  return e;
};

/** Entradas "na fila" da sessão s1 para os itens de `diaCom` (entradaId = "ent-<id>"). */
const naFila = (ids: string[]): Entrada[] =>
  congelar(ids.map((id) => entrada(`ent-${id}`, { estado: "na_fila", sessaoId: "s1", riscoConfirmado: "rotina" })));

const passo = (r: Resultado<DiaSessao>) => aplicar(r);
const E1 = { estacaoId: "e1" };
const SEM_AVISO = { semSinalSemContingencia: false, origem: PRIVADA };

/** Bruno faz check-in e é atendido: a vez de Ana (nº 1, remota) passa; a de Caio (nº 3) não. */
function brunoAtendido(ids = ["ana", "bruno", "caio"], em = T + 20 * MIN): DiaSessao {
  let d = diaCom(ids);
  d = passo(checkIn(d, { itemId: "bruno" }, em - 10 * MIN));
  d = passo(chamarProximo(d, E1, em));
  return passo(finalizar(d, E1, em + 10 * MIN));
}

describe("encerramento (RN-SES-01..04, RN-FALTA-01)", () => {
  it("RN-SES-02: vez não passou → remanejado", () => {
    const dia = diaCom(["ana", "bruno"]);
    const r = encerrar(dia, naFila(["ana", "bruno"]), T + 5 * H, SEM_AVISO);
    const { dia: d, entradas } = aplicar(r);
    expect(d.estado).toBe("encerrada");
    expect(d.itens.map((i) => i.estado)).toEqual(["remanejado", "remanejado"]);
    const ana = ent(entradas, "ent-ana");
    expect([ana.estado, ana.remanejada, ana.sessaoId, ana.recusas]).toEqual(["remanejada", "privada", null, 0]);
    // RN-REM-04: mantém risco, prioridade e data original.
    expect(ana.riscoConfirmado).toBe("rotina");
    expect(ana.dataEntradaOriginal).toBe(entrada("x").dataEntradaOriginal);
    expect(eventos(r).filter((e) => e.tipo === "remanejado")).toHaveLength(2);
    expect(eventos(r).some((e) => e.tipo === "falta")).toBe(false);
    expect(d.encerramento).toEqual({ em: T + 5 * H, faltas: [], origem: "privada" });

    // Novo prejuízo pela unidade: a origem passa a ser a desta sessão e as recusas zeram.
    const ja = congelar([
      entrada("ent-ana", { estado: "na_fila", sessaoId: "s1", remanejada: "publica", recusas: 1, alocadaEm: T - DIA }),
    ]);
    const de = ent(aplicar(encerrar(diaCom(["ana"]), ja, T + 5 * H, SEM_AVISO)).entradas, "ent-ana");
    expect([de.remanejada, de.recusas, de.alocadaEm]).toEqual(["privada", 0, null]);
  });

  it("RN-SES-02: presente nunca leva falta", () => {
    // Ana chega depois que a vez dela passou e está presente no encerramento.
    let dia = brunoAtendido();
    dia = passo(checkIn(dia, { itemId: "ana" }, T + H));
    const r = encerrar(dia, naFila(["ana", "bruno", "caio"]), T + 5 * H, SEM_AVISO);
    const { dia: d, entradas } = aplicar(r);
    expect(item(d, "ana").estado).toBe("remanejado");
    expect(ent(entradas, "ent-ana").estado).toBe("remanejada");
    expect(eventos(r).some((e) => e.tipo === "falta")).toBe(false);
    // Bruno já foi atendido: não muda.
    expect(item(d, "bruno").estado).toBe("atendido_na_etapa");
    expect(ent(entradas, "ent-bruno").estado).toBe("na_fila");
  });

  it("RN-SES-02: remoto com a vez passada leva falta", () => {
    const dia = brunoAtendido();
    const r = encerrar(dia, naFila(["ana", "bruno", "caio"]), T + 5 * H, SEM_AVISO);
    const { dia: d, entradas } = aplicar(r);
    expect(item(d, "ana").estado).toBe("saiu_da_fila");
    const ana = ent(entradas, "ent-ana");
    expect([ana.estado, ana.sessaoId]).toEqual(["encerrada_sem_atendimento", "s1"]);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "falta", itemId: "ana", entradaId: "ent-ana" }));
    // Caio vem depois de Bruno: a vez dele não passou.
    expect(item(d, "caio").estado).toBe("remanejado");
    expect(ent(entradas, "ent-caio").estado).toBe("remanejada");
    expect(d.encerramento?.faltas).toEqual(["ana"]);
  });

  it("RN-SES-02/RN-CHAM-03: quem voltou a remoto no 2º pulo leva falta se depois a vez passou", () => {
    let dia = diaCom(["ana", "bruno"]);
    dia = passo(checkIn(dia, { itemId: "ana" }, T));
    dia = passo(chamarProximo(dia, E1, T + MIN));
    dia = passo(naoCompareceu(dia, E1, T + 6 * MIN)); // 1º pulo: presente
    dia = passo(chamarProximo(dia, E1, T + 7 * MIN));
    dia = passo(naoCompareceu(dia, E1, T + 12 * MIN)); // 2º pulo: remoto, saiuEm
    expect([item(dia, "ana").estado, item(dia, "ana").pulos]).toEqual(["remoto", 2]);
    // "A vez passou" é alguém depois dela ser chamado (fila-do-dia): as chamadas dela não contam.
    const semNinguem = aplicar(encerrar(dia, naFila(["ana", "bruno"]), T + H, SEM_AVISO));
    expect(item(semNinguem.dia, "ana").estado).toBe("remanejado");
    // Bruno (nº 2) é chamado com ela fora: a vez dela passou.
    dia = passo(checkIn(dia, { itemId: "bruno" }, T + 13 * MIN));
    dia = passo(chamarProximo(dia, E1, T + 14 * MIN));
    dia = passo(finalizar(dia, E1, T + 20 * MIN));
    const { dia: d, entradas } = aplicar(encerrar(dia, naFila(["ana", "bruno"]), T + H, SEM_AVISO));
    expect(item(d, "ana").estado).toBe("saiu_da_fila");
    expect(ent(entradas, "ent-ana").estado).toBe("encerrada_sem_atendimento");
    expect(item(d, "bruno").estado).toBe("atendido_na_etapa");
  });

  it("RN-SES-02/AD-010: chamada feita com a pessoa ainda presente não passa a vez de quem depois saiu", () => {
    // Ana (nº 1) chega e fica travada atrás de Bruno (nº 2, presente antes): Bruno é chamado com ela
    // na unidade; ela toca "Vou sair" e está remota no encerramento.
    let dia = diaCom(["ana", "bruno"]);
    dia = passo(checkIn(dia, { itemId: "bruno" }, T));
    dia = passo(checkIn(dia, { itemId: "ana" }, T + MIN));
    expect(item(dia, "ana").travadoAtras).toEqual(["bruno"]);
    dia = passo(chamarProximo(dia, E1, T + 2 * MIN));
    expect(item(dia, "bruno").estado).toBe("chamado");
    dia = passo(finalizar(dia, E1, T + 10 * MIN));
    dia = passo(vouSair(dia, { itemId: "ana" }, T + 11 * MIN));
    const { dia: d } = aplicar(encerrar(dia, naFila(["ana", "bruno"]), T + H, SEM_AVISO));
    expect(item(d, "ana").estado).toBe("remanejado");
  });

  it("AD-041: triado que saiu é remanejado, não faltoso", () => {
    // Luísa foi atendida na triagem, tocou "Vou sair" e, fora, a vez dela passou no consultório.
    let dia = diaCom(["luisa", "bruno"], { exigeTriagem: true });
    dia = comItem(dia, "luisa", { estado: "presente", atendidoEmEtapas: ["triagem"] });
    dia = passo(vouSair(dia, { itemId: "luisa" }, T));
    dia = passo(checkIn(dia, { itemId: "bruno" }, T + MIN));
    dia = passo(chamarProximo(dia, E1, T + 10 * MIN));
    dia = passo(finalizar(dia, E1, T + 20 * MIN));
    const r = encerrar(dia, naFila(["luisa", "bruno"]), T + 5 * H, SEM_AVISO);
    const { dia: d, entradas } = aplicar(r);
    expect(item(d, "luisa").estado).toBe("remanejado");
    expect(ent(entradas, "ent-luisa").estado).toBe("remanejada");
    expect(eventos(r).some((e) => e.tipo === "falta")).toBe(false);
  });

  it("RN-SES-03: não encerra com estação chamando", () => {
    let dia = diaCom(["ana"]);
    dia = passo(checkIn(dia, { itemId: "ana" }, T));
    dia = passo(chamarProximo(dia, E1, T + MIN));
    expect(erro(encerrar(dia, naFila(["ana"]), T + H, SEM_AVISO))).toBe("estacao_com_chamado");
    // Item chamado sem a estação apontando (estado da fixture) também bloqueia.
    expect(erro(encerrar(chamar(diaCom(["ana"]), "ana", T), naFila(["ana"]), T + H, SEM_AVISO))).toBe(
      "estacao_com_chamado",
    );
    // Depois de Finalizar, encerra.
    const fim = passo(finalizar(dia, E1, T + 10 * MIN));
    expect(erro(encerrar(fim, naFila(["ana"]), T + H, SEM_AVISO))).toBe("ok");
    // RN-SES-01: só a partir de aberta.
    expect(erro(encerrar(diaCom([], { estado: "planejada" }), [], T, SEM_AVISO))).toBe("transicao_proibida");
    expect(erro(encerrar(diaCom([], { estado: "encerrada" }), [], T, SEM_AVISO))).toBe("transicao_proibida");
  });

  it("RN-SES-04: avisa sinal perdido sem bloquear", () => {
    const dia = diaCom(["ana"]);
    const com = encerrar(dia, naFila(["ana"]), T + H, { semSinalSemContingencia: true, origem: PRIVADA });
    expect(com.ok).toBe(true);
    expect(com.aviso).toBe("sinal_perdido");
    const sem = encerrar(dia, naFila(["ana"]), T + H, SEM_AVISO);
    expect(sem.ok).toBe(true);
    expect("aviso" in sem).toBe(false);
  });

  it("RN-SES-02: reserva da sessão é cancelada no encerramento", () => {
    const reserva = entrada("r1", { estado: "na_reserva", sessaoId: "s1" });
    const outra = entrada("r2", { estado: "na_reserva", sessaoId: "s2" });
    const r = encerrar(diaCom([]), congelar([reserva, outra]), T + H, {
      semSinalSemContingencia: false,
      origem: "publica",
    });
    const { entradas } = aplicar(r);
    expect(ent(entradas, "r1").estado).toBe("cancelada");
    expect(ent(entradas, "r2")).toBe(outra);
  });

  it("RN-CONT-03: vez passada só em contingência registrada → remanejado no encerramento", () => {
    const dia = congelar({ ...brunoAtendido(), contingencias: [{ inicio: T, fim: T + H, motivo: "queda" }] });
    const r = encerrar(dia, naFila(["ana", "bruno", "caio"]), T + 5 * H, SEM_AVISO);
    const { dia: d } = aplicar(r);
    expect(item(d, "ana").estado).toBe("remanejado");
    expect(eventos(r).some((e) => e.tipo === "falta")).toBe(false);
  });

  it("RN-CONT-03: contingência registrada depois do encerramento apaga a falta e remaneja", () => {
    // Bruno chamado às 07:20 (Brasília); sessão encerrada às 12:00 com falta de Ana.
    const fechado = aplicar(encerrar(brunoAtendido(), naFila(["ana", "bruno", "caio"]), T + 5 * H, SEM_AVISO));
    expect(ent(fechado.entradas, "ent-ana").estado).toBe("encerrada_sem_atendimento");

    // Às 13:00 do mesmo dia, a recepção registra a queda das 07:00 às 08:00.
    const periodo = { inicio: T, fim: T + H, motivo: "internet caiu" };
    const r = registrarContingencia(fechado.dia, fechado.entradas, periodo, T + 6 * H);
    const { dia, entradas } = aplicar(r);
    expect(dia.contingencias).toEqual([periodo]);
    expect(item(dia, "ana").estado).toBe("remanejado");
    const ana = ent(entradas, "ent-ana");
    expect([ana.estado, ana.remanejada, ana.sessaoId]).toEqual(["remanejada", "privada", null]);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "falta_apagada", entradaId: "ent-ana" }));
    expect(dia.encerramento?.faltas).toEqual([]);

    // Período que não cobre a vez dela: a falta fica.
    const fora = aplicar(
      registrarContingencia(
        fechado.dia,
        fechado.entradas,
        { inicio: T + 2 * H, fim: T + 3 * H, motivo: "x" },
        T + 6 * H,
      ),
    );
    expect(ent(fora.entradas, "ent-ana").estado).toBe("encerrada_sem_atendimento");

    // Período que ainda não terminou: recusado (registra-se na volta).
    expect(erro(registrarContingencia(fechado.dia, fechado.entradas, { ...periodo, fim: T + 7 * H }, T + 6 * H))).toBe(
      "transicao_proibida",
    );
    // Com a sessão aberta: só grava o período (a regra de atraso e o encerramento o usam).
    const aberto = aplicar(registrarContingencia(brunoAtendido(), [], periodo, T + 2 * H));
    expect([aberto.dia.estado, aberto.dia.contingencias]).toEqual(["aberta", [periodo]]);

    // Entrada que não veio (ou não está encerrada por falta): o item e a falta ficam como estão.
    for (const entradas of [
      [],
      fechado.entradas.map((e) => (e.id === "ent-ana" ? { ...e, estado: "cancelada" as const } : e)),
    ]) {
      const sem = aplicar(registrarContingencia(fechado.dia, entradas, periodo, T + 6 * H));
      expect(item(sem.dia, "ana").estado).toBe("saiu_da_fila");
      expect(sem.dia.encerramento?.faltas).toEqual(["ana"]);
    }

    // Registrado no dia seguinte: grava o período, mas não recalcula.
    const depois = aplicar(registrarContingencia(fechado.dia, fechado.entradas, periodo, T + DIA));
    expect(depois.dia.contingencias).toEqual([periodo]);
    expect(ent(depois.entradas, "ent-ana").estado).toBe("encerrada_sem_atendimento");

    // Período inválido e sessão que não abriu: recusados.
    expect(erro(registrarContingencia(fechado.dia, fechado.entradas, { ...periodo, fim: T }, T + 6 * H))).toBe(
      "transicao_proibida",
    );
    expect(erro(registrarContingencia(diaCom([], { estado: "planejada" }), [], periodo, T + 6 * H))).toBe(
      "transicao_proibida",
    );
  });

  it('RN-CONT-03: "no mesmo dia" é o dia do encerramento no fuso da unidade (limite da meia-noite)', () => {
    // Encerrada às 23:30 de 13/11 em Brasília (02:30 UTC de 14/11), com falta de Ana.
    const fechado = aplicar(
      encerrar(brunoAtendido(), naFila(["ana", "bruno", "caio"]), Date.UTC(2026, 10, 14, 2, 30), SEM_AVISO),
    );
    const periodo = { inicio: T, fim: T + H, motivo: "queda" };
    const registrar = (em: number) =>
      ent(aplicar(registrarContingencia(fechado.dia, fechado.entradas, periodo, em)).entradas, "ent-ana").estado;
    expect(registrar(Date.UTC(2026, 10, 14, 2, 59, 59))).toBe("remanejada"); // 23:59:59, mesmo dia
    expect(registrar(Date.UTC(2026, 10, 14, 3, 0))).toBe("encerrada_sem_atendimento"); // 00:00 do dia seguinte
  });

  it("RN-ID-06/AD-040: titular da falta", () => {
    const e = entrada("x");
    const casos: [conferida: boolean, verificado: boolean, lancada: boolean, titular: string][] = [
      [true, false, false, "pessoa"], // pessoa atendida conferida na unidade
      [false, true, false, "responsavel"], // não conferida: vai ao responsável verificado
      [false, false, false, "ninguem"], // conta não verificada: não vai ao CPF de ninguém
      [false, false, true, "pessoa"], // lançado pela regulação: CPF veio da regulação
    ];
    for (const [conferida, verificado, lancada, titular] of casos) {
      expect(titularDaFalta(e, conferida, verificado, lancada)).toBe(titular);
    }
    // Pessoa local sem conta e não conferida: ninguém.
    expect(titularDaFalta(entrada("y", { responsavelId: null }), false, true, false)).toBe("ninguem");
  });
});

describe("cancelamento da sessão (RN-REM)", () => {
  it("cancelar: reserva é cancelada, não remanejada", () => {
    const entradas = congelar([
      entrada("conf", { estado: "confirmada", sessaoId: "s1" }),
      entrada("segura", { estado: "aguardando_encaminhamento", sessaoId: "s1" }),
      entrada("res", { estado: "na_reserva", sessaoId: "s1" }),
      entrada("lista", { estado: "aguardando" }),
    ]);
    const dia = diaCom([], { estado: "planejada" });
    const r = cancelar(dia, entradas, T - H, { origem: "publica" });
    const { dia: d, entradas: novas } = aplicar(r);
    expect(d.estado).toBe("cancelada");
    expect(ent(novas, "conf").estado).toBe("remanejada");
    expect(ent(novas, "conf").remanejada).toBe("publica");
    expect(ent(novas, "segura").estado).toBe("remanejada");
    expect(ent(novas, "res").estado).toBe("cancelada");
    expect(ent(novas, "lista")).toBe(entradas[3]);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "cancelada", entradaId: "res" }));
  });

  it("cancelar: com a sessão aberta, inclusive o chamado vira remanejado", () => {
    let dia = brunoAtendido(["ana", "bruno", "caio"]);
    dia = passo(checkIn(dia, { itemId: "caio" }, T + H));
    dia = passo(chamarProximo(dia, E1, T + H + MIN));
    expect(item(dia, "caio").estado).toBe("chamado");
    const r = cancelar(dia, naFila(["ana", "bruno", "caio"]), T + 2 * H, { origem: PRIVADA });
    const { dia: d, entradas } = aplicar(r);
    expect(d.estado).toBe("cancelada");
    expect(item(d, "caio").estado).toBe("remanejado");
    expect(item(d, "ana").estado).toBe("remanejado"); // cancelamento nunca gera falta
    expect(item(d, "bruno").estado).toBe("atendido_na_etapa"); // já atendido não é afetado
    expect(d.estacoes[0]?.chamadoItemId).toBeNull();
    expect(ent(entradas, "ent-caio").estado).toBe("remanejada");
    expect(ent(entradas, "ent-bruno").estado).toBe("na_fila");
    expect(eventos(r).some((e) => e.tipo === "falta")).toBe(false);
    // Já encerrada ou cancelada: não cancela de novo.
    expect(erro(cancelar(d, entradas, T + 3 * H, { origem: PRIVADA }))).toBe("transicao_proibida");
  });

  it("RN-REM-03: origem do remanejado vem da sessão e do serviço", () => {
    const servico = (modo: Servico["modo"]): Servico => ({ id: "cli", modo, exigeTriagem: false });
    expect(origemDaSessao(sessaoVagas(), servico("livre"))).toBe("privada");
    expect(origemDaSessao(sessaoVagas({ visibilidade: "publica" }), servico("livre"))).toBe("publica");
    expect(origemDaSessao(sessaoVagas(), servico("regulado"))).toBe("regulada");
  });
});

describe("remanejado (RN-REM-03..05)", () => {
  it("RN-REM-03: outra data 1ª mantém, 2ª perde a preferência por origem", () => {
    // 1ª vez: continua remanejado, com a preferência, e libera a vaga.
    const conf = entrada("ana", { estado: "confirmada", sessaoId: "s2", remanejada: "privada" });
    const s2 = sessaoVagas({ id: "s2", ocupadas: 1 });
    const r1 = outraData(conf, s2, T);
    const { entrada: a1, sessao: s2depois } = aplicar(r1);
    expect([a1.estado, a1.remanejada, a1.recusas, a1.sessaoId]).toEqual(["remanejada", "privada", 1, null]);
    expect(s2depois.ocupadas).toBe(0);
    expect(eventos(r1)).toContainEqual(expect.objectContaining({ tipo: "vaga_liberada", sessaoId: "s2" }));

    // 2ª vez, por origem.
    const s3 = sessaoVagas({ id: "s3", ocupadas: 1 });
    const segunda = (remanejada: Entrada["remanejada"]) =>
      outraData(entrada("ana", { estado: "alocada", sessaoId: "s3", remanejada, recusas: 1, alocadaEm: T }), s3, T);
    const priv = aplicar(segunda("privada")).entrada;
    expect([priv.estado, priv.remanejada, priv.dataEntradaOriginal]).toEqual([
      "aguardando",
      null,
      entrada("x").dataEntradaOriginal,
    ]);
    const pub = segunda("publica");
    expect(aplicar(pub).entrada.estado).toBe("cancelada");
    expect(eventos(pub)).toContainEqual(expect.objectContaining({ tipo: "cancelada", motivo: "inscreva-se de novo" }));
    const reg = segunda("regulada");
    expect(aplicar(reg).entrada.estado).toBe("cancelada");
    expect(eventos(reg)).toContainEqual(
      expect.objectContaining({ tipo: "cancelada", motivo: "comunicar a regulação" }),
    );

    // Na fila, ainda remoto: sai da fila do dia; presente não pode.
    const dia = diaCom(["ana"]);
    const naFilaAna = entrada("ent-ana", { estado: "na_fila", sessaoId: "s1", remanejada: "privada" });
    const s1 = sessaoVagas({ ocupadas: 1 });
    const nf = aplicar(outraData(naFilaAna, s1, T, dia));
    expect(nf.entrada.estado).toBe("remanejada");
    expect(nf.dia && item(nf.dia, "ana").estado).toBe("saiu_da_fila");
    const presente = comItem(dia, "ana", { estado: "presente" });
    expect(erro(outraData(naFilaAna, s1, T, presente))).toBe("transicao_proibida");
    expect(erro(outraData(naFilaAna, s1, T))).toBe("transicao_proibida");

    // Não remanejado, ou 2ª vez sem linha no contrato: recusado.
    expect(erro(outraData(entrada("b", { estado: "confirmada", sessaoId: "s2" }), s2, T))).toBe("transicao_proibida");
    expect(erro(outraData({ ...naFilaAna, recusas: 1 }, s1, T, dia))).toBe("transicao_proibida");
    // Sessão que não é a da entrada: recusado.
    expect(erro(outraData(conf, s3, T))).toBe("transicao_proibida");
  });

  it('RN-REM-03: "Outra data" só na sessão privada ou regulada; remanejado em sessão pública não tem', () => {
    // Ana, remanejada de pública, escolheu outra sessão pública (RN-REM-05): ali não há "Outra data".
    const pub = sessaoVagas({ id: "s2", visibilidade: "publica", ocupadas: 1 });
    const ana = entrada("ana", { estado: "confirmada", sessaoId: "s2", remanejada: "publica" });
    expect(erro(outraData(ana, pub, T))).toBe("transicao_proibida");
    expect(erro(outraData({ ...ana, recusas: 1 }, pub, T))).toBe("transicao_proibida");
    // Alocada numa privada, tem.
    const priv = sessaoVagas({ id: "s2", ocupadas: 1 });
    expect(aplicar(outraData(ana, priv, T)).entrada.estado).toBe("remanejada");
  });

  it('RN-REM-03: recusar e "Outra data" de remanejada alocada dão o mesmo resultado (uma regra só)', () => {
    const s = sessaoVagas({ id: "s2", ocupadas: 1 });
    for (const remanejada of ["privada", "publica", "regulada"] as const) {
      for (const recusas of [0, 1]) {
        const e = entrada("ana", { estado: "alocada", sessaoId: "s2", remanejada, recusas, alocadaEm: T });
        const a = recusar(e, s, T);
        const b = outraData(e, s, T);
        if (!a.ok || !b.ok) throw new Error("recusado");
        expect({ entrada: b.estado.entrada, sessao: b.estado.sessao }).toEqual(a.estado);
        expect(b.estado.dia).toBeNull();
        expect(b.eventos).toEqual(a.eventos);
      }
    }
  });

  it("RN-REM-03: Desistir cancela de vez", () => {
    const conf = entrada("ana", { estado: "confirmada", sessaoId: "s2", remanejada: "regulada" });
    const r = desistir(conf, T);
    expect([aplicar(r).entrada.estado, aplicar(r).entrada.remanejada]).toEqual(["cancelada", null]);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "vaga_liberada", sessaoId: "s2" }));
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "cancelada", motivo: "comunicar a regulação" }));
    // Aguardando remarcação também desiste.
    expect(aplicar(desistir(entrada("b", { estado: "remanejada", remanejada: "publica" }), T)).entrada.estado).toBe(
      "cancelada",
    );
    expect(erro(desistir(entrada("c", { estado: "confirmada", sessaoId: "s2" }), T))).toBe("transicao_proibida");

    // Na fila (remoto ou presente): sai da fila do dia; chamado, não.
    const dia = diaCom(["ana"]);
    const naFilaAna = entrada("ent-ana", { estado: "na_fila", sessaoId: "s1", remanejada: "privada" });
    for (const estado of ["remoto", "presente"] as const) {
      const d = aplicar(desistir(naFilaAna, T, comItem(dia, "ana", { estado })));
      expect([d.entrada.estado, d.dia && item(d.dia, "ana").estado]).toEqual(["cancelada", "saiu_da_fila"]);
    }
    expect(erro(desistir(naFilaAna, T, chamar(dia, "ana", T)))).toBe("transicao_proibida");
    expect(erro(desistir(naFilaAna, T))).toBe("transicao_proibida");
  });

  it("RN-REM-05: remanejado de pública escolhe; lotada → topo da reserva", () => {
    const ana = entrada("ana", { estado: "remanejada", remanejada: "publica", sessaoId: null });
    const sessao = sessaoVagas({ id: "s2", visibilidade: "publica", vagas: 2, ocupadas: 1 });

    // Com vaga: confirmado, ocupando a vaga.
    const r = escolherData(ana, sessao, null, { servico: LIVRE, fotoAceita: false }, T);
    const ok = aplicar(r);
    expect([ok.entrada.estado, ok.entrada.sessaoId, ok.entrada.remanejada]).toEqual(["confirmada", "s2", "publica"]);
    expect(ok.sessao.ocupadas).toBe(2);

    // Sessão já aberta: direto na fila remota com o próximo número.
    const dia = diaCom(["x"], { sessaoId: "s2" });
    const aberta = aplicar(escolherData(ana, sessao, dia, { servico: LIVRE, fotoAceita: false }, T));
    expect(aberta.entrada.estado).toBe("na_fila");
    const it2 = aberta.dia?.itens.find((i) => i.entradaId === "ana");
    expect([it2?.estado, it2?.numero]).toEqual(["remoto", 2]);

    // Requisição sem foto: vaga segura antes da abertura; com a sessão aberta, recusado.
    const seg = aplicar(escolherData(ana, sessao, null, { servico: REQUISICAO, fotoAceita: false }, T));
    expect(seg.entrada.estado).toBe("aguardando_encaminhamento");
    expect(erro(escolherData(ana, sessao, dia, { servico: REQUISICAO, fotoAceita: false }, T))).toBe(
      "requisicao_pendente",
    );

    // Lotada: topo da reserva, sem ocupar vaga; a vaga liberada vai a ela antes de quem já esperava.
    const cheia = sessaoVagas({ id: "s2", visibilidade: "publica", vagas: 1, ocupadas: 1 });
    const res = aplicar(escolherData(ana, cheia, null, { servico: LIVRE, fotoAceita: false }, T));
    expect([res.entrada.estado, res.entrada.sessaoId]).toEqual(["na_reserva", "s2"]);
    expect(res.sessao.ocupadas).toBe(1);
    const antiga = entrada("antiga", {
      estado: "na_reserva",
      sessaoId: "s2",
      dataEntradaOriginal: res.entrada.dataEntradaOriginal - 30 * DIA,
    });
    const lib = aplicar(
      liberarVaga(res.sessao, null, congelar([antiga, res.entrada]), { servico: LIVRE, fotosAceitas: [] }, T + H),
    );
    expect(ent(lib.entradas, "ana").estado).toBe("confirmada");
    expect(ent(lib.entradas, "antiga").estado).toBe("na_reserva");

    // Só remanejado de pública, em sessão pública do serviço.
    const priv = entrada("b", { estado: "remanejada", remanejada: "privada" });
    expect(erro(escolherData(priv, sessao, null, { servico: LIVRE, fotoAceita: false }, T))).toBe("transicao_proibida");
    expect(erro(escolherData(ana, sessaoVagas({ id: "s2" }), null, { servico: LIVRE, fotoAceita: false }, T))).toBe(
      "transicao_proibida",
    );
    // Já tem item no dia (INV-05): duplicada.
    const comAna = diaCom(["ana"], { sessaoId: "s2" });
    const anaComId = { ...ana, id: "ent-ana" };
    expect(erro(escolherData(anaComId, sessao, comAna, { servico: LIVRE, fotoAceita: false }, T))).toBe("duplicada");
  });

  it("INV-10: remanejado nunca tira a vaga de quem já está confirmado", () => {
    const cheia = sessaoVagas({ id: "s2", visibilidade: "publica", vagas: 2, ocupadas: 2 });
    const confirmados = congelar([
      entrada("a", { estado: "confirmada", sessaoId: "s2" }),
      entrada("b", { estado: "confirmada", sessaoId: "s2" }),
    ]);
    const ana = entrada("ana", { estado: "remanejada", remanejada: "publica" });
    const r = aplicar(escolherData(ana, cheia, null, { servico: LIVRE, fotoAceita: false }, T));
    expect(r.entrada.estado).toBe("na_reserva");
    expect(r.sessao.ocupadas).toBe(2);
    // Mesmo com a sessão aberta e cheia, ninguém sai da fila por causa dela.
    const dia = diaCom(["a", "b"], { sessaoId: "s2" });
    const r2 = aplicar(escolherData(ana, cheia, dia, { servico: LIVRE, fotoAceita: false }, T));
    expect(r2.entrada.estado).toBe("na_reserva");
    expect(r2.dia).toBe(dia);
    // A reserva só recebe vaga livre: sem liberação, os confirmados ficam.
    const semVaga = aplicar(
      liberarVaga(
        { ...cheia, ocupadas: 3 },
        null,
        congelar([...confirmados, r.entrada]),
        {
          servico: LIVRE,
          fotosAceitas: [],
        },
        T,
      ),
    );
    expect(semVaga.entradas.filter((e) => e.estado === "confirmada").map((e) => e.id)).toEqual(["a", "b"]);
    expect(ent(semVaga.entradas, "ana").estado).toBe("na_reserva");
  });

  it("ações de encerramento não alteram o que recebem", () => {
    // Tudo acima usa estado congelado em profundidade; aqui, a cadeia completa.
    const dia = congelar(brunoAtendido());
    const entradas = naFila(["ana", "bruno", "caio"]);
    expect(() => {
      const f = aplicar(encerrar(dia, entradas, T + 5 * H, SEM_AVISO));
      registrarContingencia(f.dia, f.entradas, { inicio: T, fim: T + H, motivo: "x" }, T + 6 * H);
      cancelar(dia, entradas, T + 5 * H, { origem: PRIVADA });
    }).not.toThrow();
  });
});
