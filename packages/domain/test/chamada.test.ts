import { describe, expect, it } from "vitest";
import {
  chamarProximo,
  fecharEstacao,
  finalizar,
  naoCompareceu,
  rechamar,
  toleranciaEsgotada,
} from "../src/chamada.ts";
import { CONFIG_PADRAO, checkIn, type DiaSessao, type Estacao, elegiveis, vouSair } from "../src/fila.ts";
import type { Resultado } from "../src/resultado.ts";
import { comItem, congelar, diaCom } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);

function aplicar(r: Resultado<DiaSessao>): DiaSessao {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return congelar(r.estado);
}

const item = (dia: DiaSessao, id: string) => {
  const i = dia.itens.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
};
const estacao = (dia: DiaSessao, id: string) => {
  const e = dia.estacoes.find((x) => x.id === id);
  if (!e) throw new Error(`estação ${id} não existe`);
  return e;
};
const ordem = (dia: DiaSessao, estacaoId = "e1"): string[] => elegiveis(dia, estacaoId).map((i) => i.id);
const entrar = (dia: DiaSessao, id: string, agora = T) => aplicar(checkIn(dia, { itemId: id }, agora));
const chamar = (dia: DiaSessao, estacaoId = "e1", agora = T) => aplicar(chamarProximo(dia, { estacaoId }, agora));
const pular = (dia: DiaSessao, estacaoId = "e1", agora = T) => aplicar(naoCompareceu(dia, { estacaoId }, agora));
const chamadoEm = (dia: DiaSessao, estacaoId = "e1") => estacao(dia, estacaoId).chamadoItemId;

const estacaoDe = (id: string, etapa: Estacao["etapa"]): Estacao => ({
  id,
  etapa,
  servicos: ["cli"],
  aberta: true,
  chamadoItemId: null,
});

/** Serviço com triagem: estação "t1" de triagem e "e1" de atendimento; todos começam na triagem. */
function diaComTriagem(ids: string[]): DiaSessao {
  let d = diaCom(ids, { estacoes: [estacaoDe("e1", "atendimento"), estacaoDe("t1", "triagem")] });
  for (const id of ids) d = comItem(d, id, { etapa: "triagem" });
  return d;
}

/** Nenhum elegível vem antes de alguém que ainda o trava (a ordem nunca precisou do recurso sem travas). */
function respeitaTravas(dia: DiaSessao, estacaoId = "e1"): void {
  const o = ordem(dia, estacaoId);
  for (const [pos, id] of o.entries()) {
    const x = item(dia, id);
    if (x.urgenciaConfirmada) continue;
    for (const t of x.travadoAtras) {
      if (o.includes(t)) expect(o.indexOf(t), `${id} passou à frente de ${t}`).toBeLessThan(pos);
    }
  }
}

describe("RN-CHAM-01/02: chamar, encerrar a chamada anterior", () => {
  it("RN-CHAM-01/02 call: next closes previous and skips remote", () => {
    let d = diaCom(["ana", "joao", "bruno"]);
    d = entrar(d, "joao");
    d = entrar(d, "bruno");
    const r = chamarProximo(d, { estacaoId: "e1" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = congelar(r.estado);
    expect(item(d, "joao").estado).toBe("chamado"); // Ana (nº 1) está remota
    expect(chamadoEm(d)).toBe("joao");
    expect(d.chamadas).toEqual([{ itemId: "joao", etapa: "atendimento", estacaoId: "e1", em: T + MIN }]);
    expect(r.eventos).toEqual([
      {
        tipo: "chamado",
        itemId: "joao",
        entradaId: "ent-joao",
        estacaoId: "e1",
        sessaoId: "s1",
        dados: { senha: "C002", etapa: "atendimento", em: T + MIN },
      },
    ]);
    const r2 = chamarProximo(d, { estacaoId: "e1" }, T + 2 * MIN);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    d = congelar(r2.estado);
    expect(item(d, "joao")).toMatchObject({ estado: "atendido_na_etapa", atendidoEmEtapas: ["atendimento"] });
    expect(item(d, "bruno").estado).toBe("chamado");
    expect(r2.eventos.map((e) => e.tipo)).toEqual(["atendido", "chamado"]);
    expect(r2.eventos[0]).toMatchObject({ itemId: "joao", dados: { etapa: "atendimento", proximaEtapa: null } });
    // Review Focus 2: sem elegível, erro sem mudar nada (o protótipo encerrava o Bruno aqui).
    expect(chamarProximo(d, { estacaoId: "e1" }, T + 3 * MIN)).toEqual({ ok: false, erro: "nenhum_elegivel" });
    expect(item(d, "bruno").estado).toBe("chamado");
    d = aplicar(finalizar(d, { estacaoId: "e1" }, T + 3 * MIN));
    expect(item(d, "bruno").estado).toBe("atendido_na_etapa");
    expect(item(d, "ana").estado).toBe("remoto");
  });

  it("RN-CHAM-02: Finalizar encerra o atendimento atual sem chamar outro", () => {
    let d = diaCom(["ana", "joao"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    d = chamar(d);
    const r = finalizar(d, { estacaoId: "e1" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.estado, "ana").estado).toBe("atendido_na_etapa");
    expect(item(r.estado, "joao").estado).toBe("presente");
    expect(chamadoEm(r.estado)).toBeNull();
    expect(r.eventos.map((e) => e.tipo)).toEqual(["atendido"]);
    // Sem ninguém chamado, não há o que finalizar.
    expect(finalizar(congelar(r.estado), { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("RN-CHAM-02: Rechamar repete o anúncio sem reiniciar a tolerância", () => {
    let d = entrar(diaCom(["ana"]), "ana");
    d = chamar(d, "e1", T);
    const r = rechamar(d, { estacaoId: "e1" }, T + 3 * MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado).toEqual(d);
    expect(r.eventos).toEqual([
      {
        tipo: "rechamado",
        itemId: "ana",
        entradaId: "ent-ana",
        estacaoId: "e1",
        sessaoId: "s1",
        dados: { senha: "C001", em: T + 3 * MIN },
      },
    ]);
    expect(toleranciaEsgotada(congelar(r.estado), "e1", T + 5 * MIN)).toBe(true);
    expect(rechamar(diaCom(["ana"]), { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("RN-CHAM-01: chamar só com a sessão aberta", () => {
    const d = entrar(diaCom(["ana"]), "ana");
    expect(chamarProximo(congelar({ ...d, estado: "encerrada" }), { estacaoId: "e1" }, T)).toEqual({
      ok: false,
      erro: "sessao_fechada",
    });
  });
});

describe("Review Focus 2: ninguém elegível ou nenhuma estação aberta", () => {
  it("RN-CHAM-01: sem elegível, chamarProximo devolve nenhum_elegivel sem mudar nada", () => {
    const d = diaCom(["ana", "joao"]); // todos remotos
    expect(chamarProximo(d, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "nenhum_elegivel" });
    const presente = entrar(d, "ana");
    const fechada = congelar({ ...presente, estacoes: [{ ...estacao(presente, "e1"), aberta: false }] });
    expect(chamarProximo(fechada, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "nenhum_elegivel" });
    expect(chamarProximo(presente, { estacaoId: "nao_existe" }, T)).toEqual({ ok: false, erro: "nenhum_elegivel" });
  });
});

describe("Review Focus 4: duas estações chamando no mesmo estado", () => {
  it("RN-CHAM-01/INV-04: a 2ª chamada sobre o estado devolvido pela 1ª pega outro paciente", () => {
    let d = diaCom(["ana", "joao", "bruno"], {
      estacoes: [estacaoDe("e1", "atendimento"), estacaoDe("e2", "atendimento")],
    });
    for (const id of ["ana", "joao", "bruno"]) d = entrar(d, id);
    const d1 = chamar(d, "e1", T + MIN);
    const d2 = chamar(d1, "e2", T + MIN);
    expect(chamadoEm(d2, "e1")).toBe("ana");
    expect(chamadoEm(d2, "e2")).toBe("joao");
    expect(item(d2, "ana").estado).toBe("chamado");
    expect(item(d2, "joao").estado).toBe("chamado");
    expect(ordem(d2)).toEqual(["bruno"]);
  });
});

describe("RN-CHAM-03 e AD-006: Não compareceu, tolerância", () => {
  it("RN-CHAM-03 call: three skips", () => {
    let d = diaCom(["ana", "joao", "bruno"]);
    for (const id of ["ana", "joao", "bruno"]) d = entrar(d, id);
    d = chamar(d, "e1", T + MIN); // Ana
    const r1 = naoCompareceu(d, { estacaoId: "e1" }, T + 6 * MIN); // 1º pulo
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    d = congelar(r1.estado);
    expect(item(d, "ana")).toMatchObject({ estado: "presente", pulos: 1, numero: 1 });
    expect(chamadoEm(d)).toBeNull();
    expect(r1.eventos.map((e) => e.tipo)).toEqual(["pulado"]);
    expect(r1.eventos[0]).toMatchObject({ itemId: "ana", estacaoId: "e1", dados: { pulos: 1, para: "presente" } });
    expect(ordem(d)).toEqual(["joao", "ana", "bruno"]);
    d = chamar(d, "e1", T + 7 * MIN); // João
    d = chamar(d, "e1", T + 8 * MIN); // Ana de novo
    expect(item(d, "ana").estado).toBe("chamado");
    d = pular(d, "e1", T + 14 * MIN); // 2º pulo
    expect(item(d, "ana")).toMatchObject({ estado: "remoto", pulos: 2 });
    d = entrar(d, "ana", T + 20 * MIN);
    d = chamar(d, "e1", T + 21 * MIN); // Bruno
    expect(chamadoEm(d)).toBe("bruno");
    d = chamar(d, "e1", T + 22 * MIN); // Ana
    expect(chamadoEm(d)).toBe("ana");
    const r3 = naoCompareceu(d, { estacaoId: "e1" }, T + 28 * MIN); // 3º pulo
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(item(r3.estado, "ana")).toMatchObject({ estado: "saiu_da_fila", pulos: 3 });
    expect(r3.eventos.map((e) => e.tipo)).toEqual(["pulado", "falta", "saiu_da_fila"]);
    expect(r3.eventos[1]).toMatchObject({ itemId: "ana", entradaId: "ent-ana", motivo: "não compareceu à chamada" });
    expect(ordem(congelar(r3.estado))).toEqual([]);
  });

  it("RN-CHAM-03: 1º pulo não aplica atraso; chamadas feitas com a pessoa presente não contam", () => {
    let d = diaCom(["ana", "joao"]);
    d = entrar(d, "joao");
    d = entrar(d, "ana"); // Ana (nº 1) fica atrás de João (janela)
    d = chamar(d, "e1", T + MIN); // João, que vem depois de Ana em ordem, é chamado com Ana na sala
    d = chamar(d, "e1", T + 2 * MIN); // Ana
    d = pular(d, "e1", T + 8 * MIN);
    expect(item(d, "ana")).toMatchObject({ estado: "presente", numero: 1, pulos: 1 });
    expect(d.proximoNumero).toBe(3);
  });

  it("RN-CHAM-03: 2º pulo devolve a remoto marcando a saída; ao voltar só contam as chamadas feitas fora", () => {
    const ate2Pulos = () => {
      let d = diaCom(["ana", "joao", "bruno"]);
      for (const id of ["ana", "joao", "bruno"]) d = entrar(d, id);
      d = chamar(d, "e1", T + MIN); // Ana
      d = pular(d, "e1", T + 2 * MIN);
      d = chamar(d, "e1", T + 3 * MIN); // João (vem depois de Ana), chamado com Ana na sala
      d = chamar(d, "e1", T + 4 * MIN); // Ana
      d = pular(d, "e1", T + 10 * MIN);
      expect(item(d, "ana").saiuEm).toBe(T + 10 * MIN);
      return d;
    };
    // Volta sem que ninguém depois dela tenha sido chamado enquanto estava fora: mantém o número.
    expect(item(entrar(ate2Pulos(), "ana", T + 20 * MIN), "ana").numero).toBe(1);
    // Bruno (depois dela) chamado enquanto ela estava fora: a vez passou.
    let d = ate2Pulos();
    d = chamar(d, "e1", T + 12 * MIN); // Bruno
    d = entrar(d, "ana", T + 20 * MIN);
    expect(item(d, "ana").numero).toBe(4);
  });

  it("RN-CHAM-03: 3 pulos somam as etapas", () => {
    let d = diaComTriagem(["ana", "joao"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    d = chamar(d, "t1", T + MIN); // Ana na triagem
    d = pular(d, "t1", T + 7 * MIN); // 1º pulo, na triagem
    expect(item(d, "ana")).toMatchObject({ etapa: "triagem", estado: "presente", pulos: 1 });
    d = chamar(d, "t1", T + 8 * MIN); // João
    d = chamar(d, "t1", T + 9 * MIN); // Ana
    d = aplicar(finalizar(d, { estacaoId: "t1" }, T + 12 * MIN)); // Ana triada
    expect(item(d, "ana")).toMatchObject({ etapa: "atendimento", estado: "presente", pulos: 1 });
    d = chamar(d, "e1", T + 13 * MIN); // João (triado antes, na sala do consultório antes dela)
    d = chamar(d, "e1", T + 14 * MIN); // Ana no consultório
    expect(chamadoEm(d)).toBe("ana");
    d = pular(d, "e1", T + 19 * MIN); // 2º pulo: 1 na triagem, 1 no consultório
    expect(item(d, "ana")).toMatchObject({ estado: "remoto", pulos: 2 });
    d = entrar(d, "ana", T + 25 * MIN);
    d = chamar(d, "e1", T + 26 * MIN);
    expect(chamadoEm(d)).toBe("ana");
    const r = naoCompareceu(d, { estacaoId: "e1" }, T + 32 * MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.estado, "ana")).toMatchObject({ estado: "saiu_da_fila", pulos: 3 });
    expect(r.eventos.map((e) => e.tipo)).toContain("falta");
  });

  it("RN-CHAM-03: Não compareceu só com alguém chamado na estação", () => {
    const d = entrar(diaCom(["ana"]), "ana");
    expect(naoCompareceu(d, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("AD-006/RN-EST-05 call: tolerance never skips on its own", () => {
    let d = diaCom(["ana", "joao"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    d = chamar(d, "e1", T); // Ana entra no consultório
    expect(toleranciaEsgotada(d, "e1", T + 12 * MIN)).toBe(true); // consulta longa
    expect(item(d, "ana")).toMatchObject({ estado: "chamado", pulos: 0 });
    d = chamar(d, "e1", T + 12 * MIN);
    expect(chamadoEm(d)).toBe("joao");
    expect(item(d, "ana").estado).toBe("atendido_na_etapa");
    expect(toleranciaEsgotada(d, "e1", T + 18 * MIN)).toBe(true);
    expect(item(d, "joao").pulos).toBe(0);
    d = pular(d, "e1", T + 18 * MIN); // "Não compareceu"
    expect(item(d, "joao")).toMatchObject({ estado: "presente", pulos: 1 });
  });

  it("AD-006 clock: advancing re-evaluates tolerance", () => {
    let d = entrar(diaCom(["ana", "joao"]), "ana");
    expect(toleranciaEsgotada(d, "e1", T + 10 * MIN)).toBe(false); // ninguém chamado
    d = chamar(d, "e1", T);
    expect(toleranciaEsgotada(d, "e1", T + 4 * MIN)).toBe(false);
    expect(toleranciaEsgotada(d, "e1", T + 5 * MIN - 1)).toBe(false); // lado de dentro
    expect(toleranciaEsgotada(d, "e1", T + 5 * MIN)).toBe(true); // lado de fora
    expect(item(d, "ana")).toMatchObject({ estado: "chamado", pulos: 0 }); // ninguém é pulado sozinho
    const config = { ...CONFIG_PADRAO, toleranciaMin: 10 };
    expect(toleranciaEsgotada(congelar({ ...d, config }), "e1", T + 5 * MIN)).toBe(false);
  });
});

describe("RN-EST-05: estação", () => {
  it("RN-EST-05 station: cannot close while someone is called", () => {
    let d = entrar(diaCom(["ana"]), "ana");
    d = chamar(d);
    expect(fecharEstacao(d, { estacaoId: "e1" })).toEqual({ ok: false, erro: "estacao_com_chamado" });
    expect(estacao(d, "e1").aberta).toBe(true);
    d = aplicar(finalizar(d, { estacaoId: "e1" }, T + MIN));
    const r = fecharEstacao(d, { estacaoId: "e1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(estacao(r.estado, "e1").aberta).toBe(false);
    expect(fecharEstacao(d, { estacaoId: "nao_existe" })).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("RN-EST-05 station: a call from another session is not dropped", () => {
    // A estação e1 tem chamado aberto de outra sessão (item que não está nesta).
    let d = diaCom(["bia"], {
      estacoes: [{ ...estacaoDe("e1", "atendimento"), chamadoItemId: "s0-ana" }],
    });
    d = entrar(d, "bia");
    expect(chamarProximo(d, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "estacao_ocupada" });
    expect(finalizar(d, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
    expect(naoCompareceu(d, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
    expect(chamadoEm(d)).toBe("s0-ana");
    expect(fecharEstacao(d, { estacaoId: "e1" })).toEqual({ ok: false, erro: "estacao_com_chamado" });
  });
});

describe("RN-TRI: triagem", () => {
  it("RN-TRI-01/04 triage: two stages with the same ticket", () => {
    let d = diaComTriagem(["ana", "joao"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    // O consultório não chama antes da triagem.
    expect(chamarProximo(d, { estacaoId: "e1" }, T)).toEqual({ ok: false, erro: "nenhum_elegivel" });
    d = chamar(d, "t1", T + MIN);
    expect(chamadoEm(d, "t1")).toBe("ana");
    const r = chamarProximo(d, { estacaoId: "t1" }, T + 5 * MIN); // fecha a triagem da Ana e chama João
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = congelar(r.estado);
    expect(item(d, "ana")).toMatchObject({
      etapa: "atendimento",
      estado: "presente",
      senha: "C001",
      numero: 1,
      atendidoEmEtapas: ["triagem"],
    });
    expect(r.eventos[0]).toMatchObject({ tipo: "atendido", dados: { etapa: "triagem", proximaEtapa: "atendimento" } });
    expect(item(d, "joao").estado).toBe("chamado");
    d = aplicar(finalizar(d, { estacaoId: "t1" }, T + 9 * MIN)); // João triado
    expect(item(d, "joao")).toMatchObject({ etapa: "atendimento", estado: "presente" });
    expect(ordem(d)).toEqual(["ana", "joao"]);
    d = chamar(d, "e1", T + 10 * MIN);
    expect(chamadoEm(d)).toBe("ana");
    expect(item(d, "joao").numero).toBe(2); // terminar a triagem não renumera

    // Janela protegida dentro da triagem.
    let w = diaComTriagem(["ana", "joao"]);
    w = entrar(w, "joao");
    w = entrar(w, "ana"); // número melhor, mas João já estava na sala
    expect(chamadoEm(chamar(w, "t1"), "t1")).toBe("joao");

    // Chamadas da triagem não fazem ninguém perder a vez no consultório.
    let x = diaComTriagem(["ana", "joao"]);
    x = entrar(x, "ana");
    x = entrar(x, "joao");
    x = chamar(x, "t1", T + MIN); // Ana
    x = aplicar(finalizar(x, { estacaoId: "t1" }, T + 2 * MIN));
    x = aplicar(vouSair(x, { itemId: "ana" }, T + 3 * MIN)); // Ana em casa, já no consultório
    x = chamar(x, "t1", T + 4 * MIN); // João chamado na triagem
    x = entrar(x, "ana", T + 5 * MIN);
    expect(item(x, "ana").numero).toBe(1);
  });

  it("RN-TRI-04: passar da triagem ao atendimento não aplica atraso (posição original)", () => {
    let d = diaComTriagem(["ana", "joao"]);
    d = entrar(d, "joao");
    d = entrar(d, "ana"); // Ana atrás de João na triagem (janela)
    d = chamar(d, "t1", T + MIN); // João
    d = chamar(d, "t1", T + 2 * MIN); // João triado; Ana chamada na triagem
    d = chamar(d, "e1", T + 3 * MIN); // João (depois de Ana em ordem) chamado no consultório
    d = aplicar(finalizar(d, { estacaoId: "t1" }, T + 4 * MIN)); // Ana triada
    expect(item(d, "ana")).toMatchObject({ etapa: "atendimento", estado: "presente", numero: 1 });
    expect(d.proximoNumero).toBe(3);
  });
});

describe("Review Focus 3: sair e voltar com pulos no meio", () => {
  it("RN-PRES-02/C34 order: leaving and coming back never deadlocks (2º pulo)", () => {
    let d = diaCom(["ana", "joao", "bruno"]);
    for (const id of ["ana", "joao", "bruno"]) d = entrar(d, id);
    d = chamar(d, "e1", T + MIN); // Ana
    d = pular(d, "e1", T + 2 * MIN); // 1º pulo: Ana atrás de João
    respeitaTravas(d);
    d = chamar(d, "e1", T + 3 * MIN); // João
    d = chamar(d, "e1", T + 4 * MIN); // Ana
    d = pular(d, "e1", T + 5 * MIN); // 2º pulo: Ana em casa
    d = entrar(d, "ana", T + 6 * MIN);
    expect(ordem(d)).toEqual(["bruno", "ana"]);
    respeitaTravas(d);
    d = chamar(d, "e1", T + 7 * MIN);
    expect(chamadoEm(d)).toBe("bruno");
  });
});

describe("pureza", () => {
  it("ações de chamada não alteram o estado recebido (entrada congelada em profundidade)", () => {
    let d = diaCom(["ana", "joao"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    const chamado = chamar(d);
    const antes = structuredClone(chamado);
    chamarProximo(chamado, { estacaoId: "e1" }, T);
    rechamar(chamado, { estacaoId: "e1" }, T);
    finalizar(chamado, { estacaoId: "e1" }, T);
    naoCompareceu(chamado, { estacaoId: "e1" }, T);
    fecharEstacao(chamado, { estacaoId: "e1" });
    fecharEstacao(d, { estacaoId: "e1" });
    toleranciaEsgotada(chamado, "e1", T);
    const umPulo = comItem(chamado, "ana", { pulos: 1 });
    naoCompareceu(umPulo, { estacaoId: "e1" }, T);
    naoCompareceu(comItem(chamado, "ana", { pulos: 2 }), { estacaoId: "e1" }, T);
    expect(chamado).toEqual(antes);
  });
});

describe("RN-TRI-03/04: classificação confirmada na triagem", () => {
  /** Ana e João já triados e presentes no atendimento; Caio chamado na triagem. */
  function caioNaTriagem(): DiaSessao {
    let d = diaComTriagem(["ana", "joao", "caio", "duda"]);
    d = comItem(d, "ana", { etapa: "atendimento", estado: "presente", atendidoEmEtapas: ["triagem"] });
    d = comItem(d, "joao", { etapa: "atendimento", estado: "presente", atendidoEmEtapas: ["triagem"] });
    d = entrar(d, "caio");
    return chamar(d, "t1", T + MIN);
  }

  it("RN-TRI-03/04: urgência confirmada na triagem é a 1ª do atendimento", () => {
    const r = finalizar(caioNaTriagem(), { estacaoId: "t1", riscoConfirmado: "urgente" }, T + 5 * MIN);
    const d = aplicar(r);
    expect(item(d, "caio")).toMatchObject({ etapa: "atendimento", risco: "urgente", urgenciaConfirmada: true });
    expect(ordem(d)).toEqual(["caio", "ana", "joao"]);
    // A API grava entrada.riscoConfirmado (INV-07: só agendador ou triagem).
    expect(r.ok && r.eventos).toContainEqual({
      tipo: "risco_confirmado",
      itemId: "caio",
      entradaId: "ent-caio",
      estacaoId: "t1",
      sessaoId: "s1",
      dados: { nivel: "urgente", etapa: "triagem" },
    });
  });

  it("RN-TRI-03: chamar o próximo também confirma ou reclassifica quem sai da triagem", () => {
    let d = caioNaTriagem();
    d = comItem(d, "caio", { risco: "atencao" });
    d = entrar(d, "duda", T + 2 * MIN);
    d = aplicar(chamarProximo(d, { estacaoId: "t1", riscoConfirmado: "rotina" }, T + 5 * MIN));
    expect(item(d, "caio")).toMatchObject({ etapa: "atendimento", risco: "rotina", urgenciaConfirmada: false });
    expect(ordem(d)).toEqual(["ana", "joao", "caio"]);
  });

  it("RN-TRI-03: emergência recusada; só a triagem confirma; sem confirmação, nada muda", () => {
    const d = caioNaTriagem();
    expect(finalizar(d, { estacaoId: "t1", riscoConfirmado: "emergencia" }, T + 5 * MIN)).toEqual({
      ok: false,
      erro: "emergencia",
    });
    const noConsultorio = chamar(aplicar(finalizar(d, { estacaoId: "t1" }, T + 5 * MIN)), "e1", T + 6 * MIN);
    expect(finalizar(noConsultorio, { estacaoId: "e1", riscoConfirmado: "urgente" }, T + 7 * MIN)).toEqual({
      ok: false,
      erro: "transicao_proibida",
    });
    expect(item(aplicar(finalizar(d, { estacaoId: "t1" }, T + 5 * MIN)), "caio").risco).toBe("rotina");
  });
});
