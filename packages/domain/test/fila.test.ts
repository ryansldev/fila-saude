import { describe, expect, it } from "vitest";
import {
  CONFIG_PADRAO,
  checkIn,
  conferirEMarcar,
  type DiaSessao,
  darPrioridade,
  elegiveis,
  ficarElegivel,
  marcarPresencaSemApp,
  vouSair,
} from "../src/fila.ts";
import type { Resultado } from "../src/resultado.ts";
import { chamar, comItem, congelar, diaCom } from "./fixtures.ts";

const MIN = 60_000;
const T = Date.UTC(2026, 10, 12, 10, 0);

/** Estado de uma ação que deveria dar certo (também congela o resultado, para a próxima ação). */
function aplicar(r: Resultado<DiaSessao>): DiaSessao {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return congelar(r.estado);
}

const ordem = (dia: DiaSessao): string[] => elegiveis(dia, "e1").map((i) => i.id);
const item = (dia: DiaSessao, id: string) => {
  const i = dia.itens.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
};
const entrar = (dia: DiaSessao, id: string, agora = T) => aplicar(checkIn(dia, { itemId: id }, agora));
const sair = (dia: DiaSessao, id: string, agora = T) => aplicar(vouSair(dia, { itemId: id }, agora));

/**
 * A ordem respeita toda trava viva: ninguém vem antes de quem ainda o trava. Se o recurso
 * "sem candidato livre" de ordemDeChamada disparasse (ciclo de travas), isto falharia.
 */
function respeitaTravas(dia: DiaSessao): void {
  const o = ordem(dia);
  for (const [pos, id] of o.entries()) {
    const x = item(dia, id);
    if (x.urgenciaConfirmada) continue;
    for (const t of x.travadoAtras) {
      if (o.includes(t)) expect(o.indexOf(t), `${id} passou à frente de ${t}`).toBeLessThan(pos);
    }
  }
}

describe("janela protegida e atraso (portados do protótipo)", () => {
  it("order: RN-ORD-01 protected window", () => {
    let d = diaCom(["ana", "joao"]); // Ana tem posição melhor
    d = entrar(d, "joao");
    expect(ordem(d)).toEqual(["joao"]);
    d = entrar(d, "ana");
    expect(ordem(d)).toEqual(["joao", "ana"]);
    d = chamar(d, "joao", T + MIN);
    expect(ordem(d)).toEqual(["ana"]);
  });

  it("order: RN-ORD-03 consecutive check-ins", () => {
    let d = diaCom(["bruno", "ana", "joao"]);
    d = entrar(d, "joao");
    d = entrar(d, "ana");
    expect(ordem(d)).toEqual(["joao", "ana"]);
    d = entrar(d, "bruno");
    expect(ordem(d)).toEqual(["joao", "bruno", "ana"]);
  });

  it("order: RN-ORD-04 late arrival", () => {
    let d = diaCom(["bruno", "ana", "joao"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    expect(ordem(d)[0]).toBe("ana");
    d = chamar(d, "ana", T + MIN);
    d = entrar(d, "bruno", T + 2 * MIN);
    expect(item(d, "bruno").numero).toBe(4);
    expect(d.proximoNumero).toBe(5);
    expect(ordem(d)).toEqual(["joao", "bruno"]);
  });

  it("order: confirmed urgency jumps window", () => {
    let d = diaCom(["ana", "joao", "bruno"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    d = comItem(d, "bruno", { urgenciaConfirmada: true, risco: "urgente" });
    d = entrar(d, "bruno");
    expect(item(d, "bruno").travadoAtras).toEqual([]);
    expect(ordem(d)).toEqual(["bruno", "ana", "joao"]);
    // Urgente confirmado também não perde a vez, mesmo com alguém depois dele já chamado.
    let u = diaCom(["ana", "bruno", "edu"]);
    u = comItem(u, "bruno", { urgenciaConfirmada: true, risco: "urgente" });
    u = comItem(u, "edu", { urgenciaConfirmada: true, risco: "urgente", estado: "presente" });
    u = chamar(u, "edu", T);
    u = entrar(u, "bruno", T + MIN);
    expect(item(u, "bruno").numero).toBe(2);
  });

  it("order: leaving and coming back never deadlocks", () => {
    let d = diaCom(["ana", "joao", "bruno"]);
    d = entrar(d, "ana");
    d = entrar(d, "joao"); // João fica atrás de Ana (janela protegida)
    expect(item(d, "joao").travadoAtras).toEqual(["ana"]);
    d = sair(d, "ana", T + MIN);
    expect(ordem(d)).toEqual(["joao"]);
    d = entrar(d, "ana", T + 2 * MIN); // Ana volta: agora fica atrás de João
    expect(ordem(d)).toEqual(["joao", "ana"]);
    expect(item(d, "ana").numero).toBe(1);
  });

  it("order: coming back loses the turn only if it passed in the order", () => {
    let d = diaCom(["ana", "joao", "bruno"]);
    for (const p of ["ana", "joao", "bruno"]) d = entrar(d, p);
    d = sair(d, "ana", T + MIN);
    d = comItem(d, "bruno", { urgenciaConfirmada: true, risco: "urgente" });
    expect(ordem(d)[0]).toBe("bruno");
    d = chamar(d, "bruno", T + 2 * MIN); // número maior, mas vinha antes por ser urgente
    d = entrar(d, "ana", T + 3 * MIN);
    expect(item(d, "ana").numero).toBe(1); // não perdeu a vez
    d = sair(d, "ana", T + 4 * MIN);
    expect(ordem(d)[0]).toBe("joao");
    d = chamar(d, "joao", T + 5 * MIN); // vinha depois dela: agora a vez passou
    d = entrar(d, "ana", T + 6 * MIN);
    expect(item(d, "ana").numero).toBe(4);
  });

  it("leave: calls made while present do not cost the turn on return", () => {
    let d = diaCom(["joao", "ana"], { config: { ...CONFIG_PADRAO, janelaK: 0 } });
    d = entrar(d, "joao");
    d = entrar(d, "ana");
    d = chamar(d, "joao", T + MIN); // João (nº 1) chamado com Ana na sala
    d = comItem(d, "joao", { estado: "atendido_na_etapa", atendidoEmEtapas: ["atendimento"] });
    d = comItem(d, "ana", { risco: "atencao" }); // agora Ana viria antes dele
    d = sair(d, "ana", T + 6 * MIN);
    d = entrar(d, "ana", T + 26 * MIN);
    expect(item(d, "ana").numero).toBe(2); // manteve o lugar, como o app prometeu
  });
});

describe("ficarElegivel: atraso opcional", () => {
  it("RN-CHAM-03/RN-TRI-04: sem aplicarAtraso, mantém o número mesmo com a vez passada", () => {
    let d = diaCom(["ana", "joao"]);
    d = entrar(d, "joao");
    d = chamar(d, "joao", T + MIN); // João vem depois de Ana em ordem
    const sem = ficarElegivel(d, "ana", T + 2 * MIN, { aplicarAtraso: false });
    expect(item(sem.estado, "ana")).toMatchObject({ estado: "presente", numero: 1, saiuEm: null });
    expect(sem.estado.proximoNumero).toBe(3);
    expect(sem.eventos[0]?.dados).toMatchObject({ numero: 1, perdeuAVez: false });
    const com = ficarElegivel(d, "ana", T + 2 * MIN, { aplicarAtraso: true });
    expect(item(com.estado, "ana").numero).toBe(3);
  });
});

describe("RN-PRES: presença", () => {
  it("RN-PRES-01: check-in marca presente e emite o evento", () => {
    const r = checkIn(diaCom(["ana"]), { itemId: "ana" }, T);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.estado, "ana").estado).toBe("presente");
    expect(r.eventos.map((e) => e.tipo)).toContain("presente");
  });

  it("RN-PRES-01: check-in só com a sessão aberta e só de quem está remoto", () => {
    expect(checkIn(diaCom(["ana"], { estado: "planejada" }), { itemId: "ana" }, T)).toEqual({
      ok: false,
      erro: "sessao_fechada",
    });
    const d = entrar(diaCom(["ana"]), "ana");
    expect(checkIn(d, { itemId: "ana" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
    expect(checkIn(d, { itemId: "nao_existe" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it('RN-PRES-02: "Vou sair" volta a remoto mantendo o número; só de quem está presente', () => {
    let d = entrar(diaCom(["ana", "joao"]), "ana");
    const r = vouSair(d, { itemId: "ana" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = congelar(r.estado);
    expect(item(d, "ana")).toMatchObject({ estado: "remoto", numero: 1, saiuEm: T + MIN });
    expect(r.eventos.map((e) => e.tipo)).toEqual(["saiu"]);
    expect(vouSair(d, { itemId: "ana" }, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("RN-PRES-03: recepção marca presença de quem não tem pendência; com pendência, recusa", () => {
    const d = marcarPresencaSemApp(diaCom(["ana"]), { itemId: "ana" }, T);
    expect(d.ok && item(d.estado, "ana").estado).toBe("presente");
    const comPendencia = comItem(diaCom(["ana"]), "ana", { pendencias: ["pre_cadastro"] });
    expect(marcarPresencaSemApp(comPendencia, { itemId: "ana" }, T)).toEqual({ ok: false, erro: "pendencia" });
  });
});

describe("RN-FILA-05: conferência antes de entrar na fila presencial", () => {
  it("RN-FILA-05: check-in com pendência é recusado e o item segue remoto", () => {
    for (const p of ["conta", "pessoa_atendida", "pre_cadastro", "prioridade"] as const) {
      const d = comItem(diaCom(["ana"]), "ana", { pendencias: [p] });
      expect(checkIn(d, { itemId: "ana" }, T)).toEqual({ ok: false, erro: "pendencia" });
      expect(item(d, "ana").estado).toBe("remoto");
    }
    // Prioridade declarada e não conferida é pendência, mesmo sem estar na lista.
    const declarada = comItem(diaCom(["ana"]), "ana", {
      prioridade: { grupos: ["gestante"], conferida: false, conferidaEm: null },
    });
    expect(checkIn(declarada, { itemId: "ana" }, T)).toEqual({ ok: false, erro: "pendencia" });
    // Conferida e vencida também (lado de fora); conferida no prazo entra (lado de dentro).
    const DIA = 86_400_000;
    const vence = (conferidaEm: number) =>
      comItem(diaCom(["ana"], { config: { ...CONFIG_PADRAO, prazosPrioridade: { gestante: 30 } } }), "ana", {
        prioridade: { grupos: ["gestante"], conferida: true, conferidaEm },
      });
    expect(checkIn(vence(T - 30 * DIA), { itemId: "ana" }, T)).toEqual({ ok: false, erro: "pendencia" });
    expect(checkIn(vence(T - 30 * DIA + 1), { itemId: "ana" }, T).ok).toBe(true);
  });

  it("RN-FILA-05: recepção confere e marca presença; atraso conta a partir daí", () => {
    // Ana com conta nova: recusada no QR, conferida no balcão, entra respeitando a janela.
    let a = diaCom(["ana", "joao"]);
    a = comItem(a, "ana", { pendencias: ["conta"] });
    a = entrar(a, "joao");
    expect(checkIn(a, { itemId: "ana" }, T).ok).toBe(false);
    const r = conferirEMarcar(a, { itemId: "ana", resultado: "confere" }, T + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    a = congelar(r.estado);
    expect(item(a, "ana")).toMatchObject({ estado: "presente", pendencias: [], numero: 1 });
    expect(r.eventos.map((e) => e.tipo)).toEqual(["pendencia_resolvida", "presente"]);
    expect(ordem(a)).toEqual(["joao", "ana"]);

    // Pedro foi embora depois da recusa; voltou e já chamaram quem vinha depois dele.
    let p = diaCom(["pedro", "ana", "joao"]);
    p = comItem(p, "pedro", { pendencias: ["pre_cadastro"] });
    p = entrar(p, "ana");
    p = entrar(p, "joao");
    expect(checkIn(p, { itemId: "pedro" }, T)).toEqual({ ok: false, erro: "pendencia" });
    p = chamar(p, "ana", T + MIN);
    p = aplicar(conferirEMarcar(p, { itemId: "pedro", resultado: "confere" }, T + 3 * 60 * MIN));
    expect(item(p, "pedro").numero).toBe(4);
    expect(ordem(p)).toEqual(["joao", "pedro"]);
  });

  it("RN-FILA-05: confere também confirma a prioridade declarada", () => {
    let d = comItem(diaCom(["ana"]), "ana", {
      pendencias: ["prioridade"],
      prioridade: { grupos: ["gestante"], conferida: false, conferidaEm: null },
    });
    d = aplicar(conferirEMarcar(d, { itemId: "ana", resultado: "confere" }, T));
    expect(item(d, "ana").prioridade).toEqual({ grupos: ["gestante"], conferida: true, conferidaEm: T });
  });

  it("RN-FILA-05: recepção recusa identidade → saiu_da_fila sem falta", () => {
    const d = comItem(diaCom(["ana", "joao"]), "ana", { pendencias: ["conta"] });
    const r = conferirEMarcar(d, { itemId: "ana", resultado: "nao_confere", motivo: "documento de outra pessoa" }, T);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(item(r.estado, "ana").estado).toBe("saiu_da_fila");
    expect(r.eventos).toEqual([
      { tipo: "nao_conferiu", itemId: "ana", entradaId: "ent-ana", motivo: "documento de outra pessoa" },
    ]);
    expect(r.eventos.some((e) => e.tipo === "falta")).toBe(false);
    expect(ordem(r.estado)).toEqual([]);
    // Só de quem está remoto.
    const presente = entrar(diaCom(["ana"]), "ana");
    expect(conferirEMarcar(presente, { itemId: "ana", resultado: "nao_confere" }, T)).toEqual({
      ok: false,
      erro: "transicao_proibida",
    });
  });

  it("RN-FILA-05: prioridade não conferida é retirada e a pessoa entra sem ela", () => {
    let d = diaCom(["joao", "ana"], { config: { ...CONFIG_PADRAO, janelaK: 0 } });
    d = comItem(d, "ana", {
      pendencias: ["prioridade"],
      prioridade: { grupos: ["pcd"], conferida: false, conferidaEm: null },
    });
    d = entrar(d, "joao");
    const r = conferirEMarcar(d, { itemId: "ana", resultado: "prioridade_nao_confere" }, T);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = congelar(r.estado);
    expect(item(d, "ana")).toMatchObject({
      estado: "presente",
      pendencias: [],
      prioridade: { grupos: [], conferida: false, conferidaEm: null },
    });
    expect(r.eventos.map((e) => e.tipo)).toEqual(["prioridade_retirada", "pendencia_resolvida", "presente"]);
    expect(ordem(d)).toEqual(["joao", "ana"]); // sem a prioridade, vale o número
  });
});

describe("RN-CONT-03: contingência", () => {
  it("RN-CONT-03: chamadas no período de contingência não contam para o atraso de quem estava remoto", () => {
    const cenario = (chamadaEm: number) => {
      let d = diaCom(["bruno", "ana", "joao"], { contingencias: [{ inicio: T + 60 * MIN, fim: T + 120 * MIN }] });
      d = entrar(d, "ana");
      d = entrar(d, "joao");
      d = chamar(d, "ana", chamadaEm);
      return entrar(d, "bruno", T + 135 * MIN);
    };
    expect(item(cenario(T + 60 * MIN), "bruno").numero).toBe(1); // início do período: dentro
    expect(item(cenario(T + 120 * MIN), "bruno").numero).toBe(1); // fim do período: dentro
    expect(item(cenario(T + 120 * MIN + 1), "bruno").numero).toBe(4); // logo depois: conta
    expect(item(cenario(T + 60 * MIN - 1), "bruno").numero).toBe(4); // logo antes: conta
  });
});

describe("Review Focus 3: sair e voltar repetidas vezes", () => {
  it('RN-PRES-02/C34: 5 ciclos de "Vou sair" e check-in com chamadas no meio nunca travam a fila', () => {
    const ids = ["ana", "joao", "bruno", "dora", "edu", "fabi", "gil", "hugo"];
    let d = diaCom(ids);
    let t = T;
    const passo = () => {
      t += MIN;
      return t;
    };
    for (const id of ids.slice(0, 5)) d = entrar(d, id, passo());
    const presentes = () => d.itens.filter((i) => i.estado === "presente").map((i) => i.id);
    const confere = () => {
      const e = ordem(d);
      expect(e.length).toBe(presentes().length);
      if (presentes().length > 0) expect(e.length).toBeGreaterThan(0);
      respeitaTravas(d);
    };
    const quem = ["ana", "joao", "ana", "bruno", "joao"];
    for (const [ciclo, x] of quem.entries()) {
      if (item(d, x).estado === "presente") d = sair(d, x, passo());
      confere();
      if (ciclo % 2 === 0) {
        const primeiro = ordem(d)[0];
        if (primeiro) d = chamar(d, primeiro, passo());
        confere();
      }
      const outros = presentes().length;
      if (item(d, x).estado === "remoto") d = entrar(d, x, passo());
      confere();
      // A janela: quem acabou de ficar elegível não passa à frente dos K primeiros.
      if (outros > 0) expect(ordem(d)[0]).not.toBe(x);
      // Um novo presente a cada ciclo, para ter sempre gente chegando.
      const novo = ids[5 + (ciclo % 3)];
      if (novo && item(d, novo).estado === "remoto") d = entrar(d, novo, passo());
      confere();
    }
  });
});

describe("pureza", () => {
  it("ações não alteram o estado recebido (entrada congelada em profundidade)", () => {
    const d = comItem(diaCom(["ana", "joao", "bruno"]), "bruno", { pendencias: ["conta"] });
    const antes = structuredClone(d);
    const p = entrar(d, "joao");
    vouSair(p, { itemId: "joao" }, T);
    checkIn(d, { itemId: "ana" }, T);
    checkIn(d, { itemId: "bruno" }, T);
    marcarPresencaSemApp(d, { itemId: "ana" }, T);
    conferirEMarcar(d, { itemId: "bruno", resultado: "confere" }, T);
    conferirEMarcar(d, { itemId: "bruno", resultado: "nao_confere" }, T);
    conferirEMarcar(d, { itemId: "bruno", resultado: "prioridade_nao_confere" }, T);
    elegiveis(p, "e1");
    expect(d).toEqual(antes);
  });

  it("elegiveis: só presentes da etapa e dos serviços da estação; estação desconhecida → vazio", () => {
    let d = diaCom(["ana", "joao"], {
      estacoes: [
        { id: "e1", etapa: "atendimento", servicos: ["cli"], aberta: true, chamadoItemId: null },
        { id: "t1", etapa: "triagem", servicos: ["cli"], aberta: true, chamadoItemId: null },
        { id: "o1", etapa: "atendimento", servicos: ["odonto"], aberta: true, chamadoItemId: null },
      ],
    });
    d = comItem(d, "joao", { etapa: "triagem" });
    d = entrar(d, "ana");
    d = entrar(d, "joao");
    expect(ordem(d)).toEqual(["ana"]);
    expect(elegiveis(d, "t1").map((i) => i.id)).toEqual(["joao"]);
    expect(elegiveis(d, "o1")).toEqual([]);
    expect(elegiveis(d, "nao_existe")).toEqual([]);
  });
});

describe("RN-RISCO-04: dar prioridade (darPrioridade)", () => {
  const erro = (r: Resultado<DiaSessao>) => (r.ok ? "ok" : r.erro);
  it("RN-RISCO-04: só na 1ª presença de paciente sem app (ou inclusão no balcão); na fila, recusado", () => {
    const d = diaCom(["joao", "ana"]);
    expect(erro(darPrioridade(d, { itemId: "ana", grupos: ["pcd"], contexto: "ja_na_fila" }, T))).toBe("sem_permissao");
    const r = darPrioridade(d, { itemId: "ana", grupos: ["pcd", "idoso"], contexto: "primeira_presenca_sem_app" }, T);
    const dado = aplicar(r);
    // Idoso vem da data de nascimento (AD-027): não se dá.
    expect(item(dado, "ana").prioridade).toEqual({ grupos: ["pcd"], conferida: true, conferidaEm: T });
    expect(r.ok && r.eventos).toEqual([
      {
        tipo: "prioridade_dada",
        itemId: "ana",
        entradaId: "ent-ana",
        dados: { grupos: ["pcd"], contexto: "primeira_presenca_sem_app" },
      },
    ]);
    // Já conferida pela recepção: a presença entra sem pendência e passa à frente de João.
    const presente = aplicar(marcarPresencaSemApp(dado, { itemId: "ana" }, T + MIN));
    expect(item(presente, "ana").estado).toBe("presente");
    // Chamado, final ou sessão fechada: recusado.
    expect(
      erro(darPrioridade(chamar(d, "ana", T), { itemId: "ana", grupos: ["pcd"], contexto: "inclusao_balcao" }, T)),
    ).toBe("transicao_proibida");
    expect(
      erro(
        darPrioridade(
          { ...d, estado: "encerrada" },
          { itemId: "ana", grupos: ["pcd"], contexto: "inclusao_balcao" },
          T,
        ),
      ),
    ).toBe("sessao_fechada");
  });
});
