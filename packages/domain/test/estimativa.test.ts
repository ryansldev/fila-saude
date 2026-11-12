import { describe, expect, it } from "vitest";
import { chamarProximo, finalizar } from "../src/chamada.ts";
import { avisosSaiaDeCasa, estimar, tempoMedio } from "../src/estimativa.ts";
import { CONFIG_PADRAO, checkIn, type DiaSessao, type Estacao, vouSair } from "../src/fila.ts";
import type { Resultado } from "../src/resultado.ts";
import { comItem, congelar, diaCom, itemFila } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);
const AUTO = { modoManual: false };
const MANUAL = { modoManual: true };

function aplicar(r: Resultado<DiaSessao>): DiaSessao {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return congelar(r.estado);
}
const entrar = (dia: DiaSessao, id: string) => aplicar(checkIn(dia, { itemId: id }, T));
const chamar = (dia: DiaSessao, estacaoId = "e1") => aplicar(chamarProximo(dia, { estacaoId }, T));
const estacao = (id: string, etapa: Estacao["etapa"], aberta = true): Estacao => ({
  id,
  etapa,
  servicos: ["cli"],
  aberta,
  chamadoItemId: null,
});
const fechar = (dia: DiaSessao): DiaSessao =>
  congelar({ ...dia, estacoes: dia.estacoes.map((e) => ({ ...e, aberta: false })) });
const maisUma = (dia: DiaSessao): DiaSessao =>
  congelar({ ...dia, estacoes: [...dia.estacoes, estacao("e2", "atendimento")] });

/** Ana, João, Bruno e Dora (risco urgente: vem antes dos outros de mesmo nível). */
const quatro = (): DiaSessao => comItem(diaCom(["ana", "joao", "bruno", "dora"]), "dora", { risco: "urgente" });

describe("RN-ETA-01/01b/04: posição e tempo", () => {
  it("RN-ETA-01 queue: eta and position (remoto conta presentes e remotos à frente)", () => {
    let d = quatro(); // ordem: dora, ana, joao, bruno
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "posicao", posicao: 2, minutos: 15 });
    expect(estimar(d, "bruno", T, AUTO)).toEqual({ tipo: "posicao", posicao: 4, minutos: 45 });
    d = maisUma(d); // 3 à frente × 15 ÷ 2 = 22,5 → 23
    expect(estimar(d, "bruno", T, AUTO)).toEqual({ tipo: "posicao", posicao: 4, minutos: 23 });
  });

  it("RN-ETA-01b eta: present patient sees real call order (janela protegida)", () => {
    let d = quatro();
    d = entrar(d, "joao");
    d = entrar(d, "ana"); // ordem melhor que João, mas fica atrás dele (K=1)
    expect(estimar(d, "joao", T, AUTO)).toEqual({ tipo: "posicao", posicao: 1, minutos: 0 });
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "posicao", posicao: 2, minutos: 15 });
    d = maisUma(d);
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "posicao", posicao: 2, minutos: 8 });
    // Remoto continua com RN-ETA-01: Dora, Ana e João à frente, presentes e remotos.
    expect(estimar(d, "bruno", T, AUTO)).toEqual({ tipo: "posicao", posicao: 4, minutos: 23 });
  });

  it("RN-ETA-04/AD-003 eta: remote first sees come now; present first never does", () => {
    let d = diaCom(["ana", "joao", "dora"]);
    d = comItem(d, "dora", { risco: "urgente" });
    expect(estimar(d, "dora", T, AUTO)).toEqual({ tipo: "venha_agora" });
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "posicao", posicao: 2, minutos: 15 });
    expect(estimar(fechar(d), "dora", T, AUTO)).toEqual({ tipo: "aguardando_inicio" });
    d = entrar(d, "dora");
    expect(estimar(d, "dora", T, AUTO)).toEqual({ tipo: "posicao", posicao: 1, minutos: 0 });
  });

  const diaTriagem = (): DiaSessao => {
    const d = diaCom(["ana", "joao"], {
      estacoes: [estacao("tri", "triagem"), estacao("e1", "atendimento")],
      tempoInicialMin: { triagem: 5 },
    });
    return congelar({ ...d, itens: d.itens.map((i) => ({ ...i, etapa: "triagem" as const })) });
  };

  it("RN-ETA-01c/AD-009 triage: eta sums both stages (tempo até a triagem, consulta à parte)", () => {
    const tri = diaTriagem();
    // 1 à frente × 5 min na triagem; consulta: 5 + 1 à frente × 15 min.
    expect(estimar(tri, "joao", T, AUTO)).toEqual({
      tipo: "posicao",
      posicao: 2,
      minutos: 5,
      consulta: { minutos: 20 },
    });
    // Ana é a 1ª da triagem: venha agora, e a consulta dela segue à parte (0 + 0 à frente).
    expect(estimar(tri, "ana", T, AUTO)).toEqual({ tipo: "venha_agora", consulta: { minutos: 0 } });
    // Triagem fechada: sem tempo.
    const fechada = congelar({
      ...tri,
      estacoes: tri.estacoes.map((e) => (e.etapa === "triagem" ? { ...e, aberta: false } : e)),
    });
    expect(estimar(fechada, "joao", T, AUTO)).toEqual({ tipo: "aguardando_inicio" });
  });

  it("RN-ETA-01c/AD-009 triage: a consulta conta quem já foi triado; remoto 1º na triagem vê venha agora com consulta", () => {
    let d = entrar(diaTriagem(), "ana");
    d = chamar(d, "tri");
    d = aplicar(finalizar(d, { estacaoId: "tri" }, T)); // Ana triada, presente no consultório
    expect(estimar(d, "joao", T, AUTO)).toEqual({ tipo: "venha_agora", consulta: { minutos: 15 } });
  });

  it("RN-ETA-01c/AD-009 triage: presente ainda não triado vê posição, tempo e consulta", () => {
    let d = entrar(diaTriagem(), "ana");
    d = entrar(d, "joao");
    expect(estimar(d, "joao", T, AUTO)).toEqual({
      tipo: "posicao",
      posicao: 2,
      minutos: 5,
      consulta: { minutos: 20 },
    });
  });
});

describe("RN-ETA-02: sem estação aberta", () => {
  it("RN-ETA-02: sem estação aberta → aguardando início (remoto e presente)", () => {
    let d = quatro();
    d = entrar(d, "joao");
    const parado = fechar(d);
    expect(estimar(parado, "joao", T, AUTO)).toEqual({ tipo: "aguardando_inicio" });
    expect(estimar(parado, "bruno", T, AUTO)).toEqual({ tipo: "aguardando_inicio" });
    expect(estimar(parado, "dora", T, AUTO)).toEqual({ tipo: "aguardando_inicio" });
  });

  it("RN-ETA-02: estação aberta de outra etapa não conta; estação fechada na etapa fica aguardando", () => {
    const d = diaCom(["ana", "joao"], { estacoes: [estacao("e1", "atendimento", false), estacao("tri", "triagem")] });
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "aguardando_inicio" });
  });
});

describe("RN-ETA-03/AD-009: saia de casa", () => {
  const avisados = (eventos: { itemId?: string }[]) => eventos.map((e) => e.itemId);

  it("RN-ETA-03 queue: leave home notice once", () => {
    let d = quatro(); // dora 0, ana 15, joao 30, bruno 45
    const a1 = avisosSaiaDeCasa(d, T, AUTO);
    expect(a1.eventos.every((e) => e.tipo === "saia_de_casa")).toBe(true);
    expect(avisados(a1.eventos).sort()).toEqual(["ana", "dora"]); // 30 min exatos não é "abaixo"
    d = congelar(a1.dia);
    expect(avisosSaiaDeCasa(d, T, AUTO).eventos).toEqual([]);

    d = entrar(d, "dora");
    d = chamar(d);
    const a2 = avisosSaiaDeCasa(d, T, AUTO);
    expect(avisados(a2.eventos)).toEqual(["joao"]); // 1 à frente (Ana) = 15 min
    expect(avisosSaiaDeCasa(congelar(a2.dia), T, AUTO).eventos).toEqual([]);
  });

  it("RN-ETA-03: o limite é da unidade e vale 'abaixo de'", () => {
    const d = diaCom(["ana", "joao", "bruno"], { config: { ...CONFIG_PADRAO, saiaDeCasaMin: 31 } });
    expect(avisados(avisosSaiaDeCasa(d, T, AUTO).eventos)).toEqual(["ana", "joao", "bruno"]);
  });

  it("RN-ETA-03: só remoto recebe; presente não, e sem estação aberta ninguém", () => {
    let d = diaCom(["ana", "joao"]);
    d = entrar(d, "ana");
    expect(avisados(avisosSaiaDeCasa(d, T, AUTO).eventos)).toEqual(["joao"]);
    expect(avisosSaiaDeCasa(fechar(diaCom(["ana"])), T, AUTO).eventos).toEqual([]);
  });

  it("RN-ETA-03 triage: leave home notice per stage (um por item e etapa)", () => {
    let d = diaCom(["ana", "joao"], {
      estacoes: [estacao("tri", "triagem"), estacao("e1", "atendimento")],
      config: { ...CONFIG_PADRAO, saiaDeCasaMin: 10 },
      tempoInicialMin: { triagem: 5 },
    });
    d = congelar({ ...d, itens: d.itens.map((i) => ({ ...i, etapa: "triagem" as const })) });
    const a1 = avisosSaiaDeCasa(d, T, AUTO);
    expect(a1.eventos.map((e) => [e.itemId, e.dados?.etapa])).toEqual([
      ["ana", "triagem"],
      ["joao", "triagem"],
    ]); // João: ~5 min na triagem (a soma daria 20)
    d = congelar(a1.dia);
    d = entrar(entrar(d, "ana"), "joao");
    d = chamar(d, "tri"); // Ana na triagem
    d = chamar(d, "tri"); // João na triagem; Ana triada, presente no atendimento
    d = aplicar(finalizar(d, { estacaoId: "tri" }, T)); // João triado
    d = aplicar(vouSair(d, { itemId: "joao" }, T)); // fila do consultório: vai para casa
    // 1 à frente (Ana) × 15 min > 10: nada.
    expect(avisosSaiaDeCasa(d, T, AUTO).eventos).toEqual([]);
    d = chamar(d, "e1"); // Ana entra no consultório
    const a2 = avisosSaiaDeCasa(d, T, AUTO);
    expect(a2.eventos.map((e) => [e.itemId, e.dados?.etapa])).toEqual([["joao", "atendimento"]]);
    expect(avisosSaiaDeCasa(congelar(a2.dia), T, AUTO).eventos).toEqual([]);
  });
});

describe("RN-SES-05: modo manual", () => {
  it("RN-SES-05: modo manual não avisa e não estima", () => {
    const d = quatro();
    expect(estimar(d, "dora", T, MANUAL)).toEqual({ tipo: "modo_manual" });
    expect(estimar(d, "bruno", T, MANUAL)).toEqual({ tipo: "modo_manual" });
    const r = avisosSaiaDeCasa(d, T, MANUAL);
    expect(r.eventos).toEqual([]);
    expect(r.dia).toBe(d);
    // Ao voltar o sinal, quem não foi avisado ainda é avisado.
    expect(avisosSaiaDeCasa(d, T, AUTO).eventos.length).toBeGreaterThan(0);
  });
});

describe("RN-ETA-05: tempo médio", () => {
  /** Chamadas na estação e1 com os intervalos dados (min) entre elas; a última não tem duração. */
  function comIntervalos(gaps: number[], parcial: Partial<DiaSessao> = {}): DiaSessao {
    let em = T;
    const tempos = [em, ...gaps.map((g) => (em += g * MIN))];
    const itens = tempos.map((_, k) => itemFila(`x${k}`, k + 1));
    return diaCom([], {
      itens,
      chamadas: tempos.map((t, k) => ({ itemId: `x${k}`, etapa: "atendimento" as const, estacaoId: "e1", em: t })),
      ...parcial,
    });
  }
  const fim = T + 24 * 60 * MIN;

  it("RN-ETA-05: menos de 3 atendimentos válidos usa o tempo inicial (e o da unidade)", () => {
    expect(tempoMedio(diaCom(["a"]), "atendimento", "cli", fim)).toBe(15);
    expect(tempoMedio(comIntervalos([10, 10]), "atendimento", "cli", fim)).toBe(15); // 2 < 3
    expect(tempoMedio(comIntervalos([10, 10, 10]), "atendimento", "cli", fim)).toBe(10);
    const d = diaCom([], { config: { ...CONFIG_PADRAO, tempoMedioInicialMin: 20 } });
    expect(tempoMedio(d, "atendimento", "cli", fim)).toBe(20);
    expect(tempoMedio(diaCom([], { tempoInicialMin: { triagem: 5 } }), "triagem", "cli", fim)).toBe(5);
    expect(tempoMedio(diaCom([]), "atendimento", "outro", fim)).toBe(15);
  });

  it("RN-ETA-05: média dos últimos 10, a última chamada da estação não entra", () => {
    // 12 durações: as 2 mais antigas (20, não fora da curva) ficam fora da janela; a última chamada não é duração.
    // Com a janela: 10 de 10 min = 10. Sem a janela: (2 x 20 + 10 x 10) / 12 = 11,67.
    const gaps = [20, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    expect(tempoMedio(comIntervalos(gaps), "atendimento", "cli", fim)).toBe(10);
  });

  it("RN-ETA-05: descarta fora da curva (< 1/3 ou > 3× a mediana)", () => {
    const gaps = [10, 10, 10, 10, 10, 10, 10, 10, 2, 40]; // mediana 10: 2 < 3,33 e 40 > 30 saem
    expect(tempoMedio(comIntervalos(gaps), "atendimento", "cli", fim)).toBe(10);
    // 30 min exatos (3×) não é "fora".
    const borda = [10, 10, 10, 10, 10, 10, 10, 10, 30, 10];
    expect(tempoMedio(comIntervalos(borda), "atendimento", "cli", fim)).toBe(12);
  });

  it("RN-ETA-05: o limite inferior é 1/3 da mediana, inclusive (10/3 min não é fora da curva)", () => {
    // mediana 10; 10/3 min = 200 s exatos fica; (10/3 - 1/60) sai.
    const dentro = comIntervalos([10, 10, 10, 10, 10, 10, 10, 10 / 3, 10, 10]);
    expect(tempoMedio(dentro, "atendimento", "cli", fim)).toBeCloseTo((9 * 10 + 10 / 3) / 10, 9);
    const fora = comIntervalos([10, 10, 10, 10, 10, 10, 10, 10 / 3 - 1 / 60, 10, 10]);
    expect(tempoMedio(fora, "atendimento", "cli", fim)).toBe(10);
  });

  it("RN-ETA-05: o tempo médio calculado alimenta a estimativa", () => {
    const d = comIntervalos([10, 10, 10, 10]);
    const dia = congelar({
      ...d,
      itens: [
        ...d.itens.map((i) => ({ ...i, estado: "atendido_na_etapa" as const })),
        itemFila("a", 100),
        itemFila("b", 101),
        itemFila("c", 102),
      ],
    });
    expect(estimar(dia, "c", fim, AUTO)).toEqual({ tipo: "posicao", posicao: 3, minutos: 20 });
  });

  it("RN-ETA-05: durações por estação, só da etapa pedida", () => {
    const d = diaCom([], {
      estacoes: [estacao("e1", "atendimento"), estacao("e2", "atendimento")],
      itens: [1, 2, 3, 4, 5, 6].map((n) => itemFila(`x${n}`, n)),
      chamadas: [
        { itemId: "x1", etapa: "atendimento", estacaoId: "e1", em: T },
        { itemId: "x2", etapa: "atendimento", estacaoId: "e2", em: T + 1 * MIN },
        { itemId: "x3", etapa: "atendimento", estacaoId: "e1", em: T + 20 * MIN },
        { itemId: "x4", etapa: "atendimento", estacaoId: "e2", em: T + 21 * MIN },
        { itemId: "x5", etapa: "atendimento", estacaoId: "e1", em: T + 40 * MIN },
        { itemId: "x6", etapa: "triagem", estacaoId: "tri", em: T + 41 * MIN },
      ],
    });
    // e1: 20, 20 (última não entra); e2: 20 (última não entra) → 3 válidas = 20.
    expect(tempoMedio(d, "atendimento", "cli", fim)).toBe(20);
  });
});

describe("I4: estimativa só para quem espera na sessão aberta", () => {
  it('RN-ETA-01/RN-CHAM-02: chamado vê "chamado", não uma posição', () => {
    const d = chamar(entrar(quatro(), "ana"));
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "chamado" });
    expect(estimar(d, "ana", T, MANUAL)).toEqual({ tipo: "chamado" });
  });

  it("RN-ETA-01: atendido, fora da fila ou remanejado: fora da fila", () => {
    const d = aplicar(finalizar(chamar(entrar(quatro(), "ana")), { estacaoId: "e1" }, T + MIN));
    expect(estimar(d, "ana", T, AUTO)).toEqual({ tipo: "fora_da_fila" });
    for (const estado of ["saiu_da_fila", "remanejado"] as const) {
      expect(estimar(comItem(quatro(), "bruno", { estado }), "bruno", T, AUTO)).toEqual({ tipo: "fora_da_fila" });
    }
  });

  it("RN-SES-05: sessão planejada aguarda o início; encerrada ou cancelada, fora da fila", () => {
    expect(estimar(congelar({ ...quatro(), estado: "planejada" as const }), "ana", T, AUTO)).toEqual({
      tipo: "aguardando_inicio",
    });
    for (const estado of ["encerrada", "cancelada"] as const) {
      expect(estimar(congelar({ ...quatro(), estado }), "ana", T, AUTO)).toEqual({ tipo: "fora_da_fila" });
    }
  });
});
