import { describe, expect, it } from "vitest";
import { chamarProximo, finalizar } from "../src/chamada.ts";
import { TRANSICOES_ENTRADA } from "../src/contratos.ts";
import { encerrar } from "../src/encerramento.ts";
import { CONFIG_PADRAO, checkIn, conferirEMarcar, type DiaSessao, elegiveis } from "../src/fila.ts";
import {
  alocar,
  conferenciaNaEntrada,
  confirmar,
  destinoPorCondicao,
  type Entrada,
  listaDeLigacao,
  pendentesNaAbertura,
  type Servico,
  type SessaoVagas,
  sugerir,
} from "../src/lista.ts";
import type { Resultado } from "../src/resultado.ts";
import {
  abrir,
  abrirSessao,
  aceitarRequisicao,
  idDoItem,
  incluirNoBalcao,
  inscreverPublica,
  lancarRegulado,
  preencherDaReserva,
  refazerQuestionario,
  removerLancamento,
  trocarReserva,
} from "../src/sessao.ts";
import { congelar, entrada, problemaNovo, respostas, sessaoVagas } from "./fixtures.ts";

const MIN = 60_000;
const H = 60 * MIN;
const DIA = 24 * H;
/** 12/11/2026 07:00 em Brasília; a sessão "s1" começa em 13/11 07:00. */
const T = Date.UTC(2026, 10, 12, 10, 0);
const INICIO = Date.UTC(2026, 10, 13, 10, 0);

const LIVRE: Servico = congelar({ id: "cli", modo: "livre", exigeTriagem: false });
const REQUISICAO: Servico = congelar({ id: "car", modo: "requisicao", exigeTriagem: false });
const REGULADO: Servico = congelar({ id: "reg", modo: "regulado", exigeTriagem: false });

function aplicar<E>(r: Resultado<E>): E {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return congelar(r.estado);
}

function eventos<E>(r: Resultado<E>) {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return r.eventos;
}

const erro = <E>(r: Resultado<E>) => (r.ok ? "ok" : r.erro);

/** Dia da sessão ainda planejado, sem itens. */
function diaPlanejado(parcial: Partial<DiaSessao> = {}): DiaSessao {
  return congelar({
    sessaoId: "s1",
    servicoId: "cli",
    estado: "planejada",
    itens: [],
    chamadas: [],
    avisosSaiaDeCasa: [],
    estacoes: [{ id: "e1", etapa: "atendimento", servicos: ["cli"], aberta: true, chamadoItemId: null }],
    config: CONFIG_PADRAO,
    contingencias: [],
    proximoNumero: 1,
    prefixoSenha: "C",
    exigeTriagem: false,
    ...parcial,
  });
}

/** A sessão com uma vaga a menos ocupada: quem saiu já a liberou (a saída do teste é feita à mão). */
const livre = (s: SessaoVagas): SessaoVagas => ({ ...s, ocupadas: s.ocupadas - 1 });

const publica = (parcial: Partial<SessaoVagas> = {}) => sessaoVagas({ visibilidade: "publica", ...parcial });

type Estado = { sessao: SessaoVagas; dia: DiaSessao | null; entradas: Entrada[] };

/** Inscreve `nome` na sessão pública (adulto sem prioridade, sem CPF) e acumula o estado. */
function inscrever(
  st: Estado,
  nome: string,
  agora = T,
  extra: { servico?: Servico; fotoAceita?: boolean; nascimento?: string } = {},
): Estado {
  const r = inscreverPublica(
    st.sessao,
    st.dia,
    {
      servico: extra.servico ?? LIVRE,
      pessoa: { nome, nascimento: extra.nascimento ?? "1990-01-01", cpf: null },
      responsavelId: nome,
      respostas: respostas(),
      id: nome,
      entradasAtivas: st.entradas,
      fotoAceita: extra.fotoAceita ?? false,
    },
    agora,
  );
  const { entrada: e, sessao, dia } = aplicar(r);
  return { sessao, dia, entradas: [...st.entradas, e] };
}

const ent = (st: Estado, id: string): Entrada => {
  const e = st.entradas.find((x) => x.id === id);
  if (!e) throw new Error(`entrada ${id} não existe`);
  return e;
};

const itemDe = (dia: DiaSessao | null, entradaId: string) => dia?.itens.find((i) => i.entradaId === entradaId);

describe("abertura (RN-FILA-01)", () => {
  it("queue: open numbers by original date", () => {
    const joao = entrada("joao", { dataEntradaOriginal: T - 5 * DIA });
    const ana = entrada("ana", { dataEntradaOriginal: T - 9 * DIA });
    const bruno = entrada("bruno", { dataEntradaOriginal: T - DIA });
    let s = sessaoVagas();
    const alocadas = [joao, ana, bruno].map((e) => {
      const r = aplicar(alocar(e, s, {}, T));
      s = r.sessao;
      return r.entrada;
    });
    const confirmadas = alocadas.map((e) => (e.id === "bruno" ? e : aplicar(confirmar(e, s, T))));

    const r = abrirSessao(diaPlanejado(), s, congelar(confirmadas), { servico: LIVRE, fotosAceitas: [] }, INICIO);
    const { dia, entradas, sessao } = aplicar(r);
    expect(dia.estado).toBe("aberta");
    const ia = itemDe(dia, "ana");
    const ij = itemDe(dia, "joao");
    expect([ia?.numero, ia?.senha, ia?.estado]).toEqual([1, "C-001", "remoto"]);
    expect([ij?.numero, ij?.senha]).toEqual([2, "C-002"]);
    expect(itemDe(dia, "bruno")).toBeUndefined();
    expect(dia.proximoNumero).toBe(3);
    const b = entradas.find((e) => e.id === "bruno");
    expect([b?.estado, b?.sessaoId]).toEqual(["aguardando", null]);
    expect(entradas.find((e) => e.id === "ana")?.estado).toBe("na_fila");
    expect(sessao.ocupadas).toBe(2);
  });

  it("RN-FILA-01: abrir só a partir de planejada e só com as confirmadas da sessão", () => {
    const outra = entrada("x", { estado: "confirmada", sessaoId: "s2" });
    const minha = entrada("y", { estado: "confirmada", sessaoId: "s1" });
    const { dia, entradas } = aplicar(abrir(diaPlanejado(), congelar([outra, minha]), INICIO));
    expect(dia.itens.map((i) => i.entradaId)).toEqual(["y"]);
    expect(dia.itens[0]?.id).toBe(idDoItem("y", "s1"));
    expect(entradas.find((e) => e.id === "x")?.estado).toBe("confirmada");
    expect(erro(abrir(dia, [], INICIO))).toBe("transicao_proibida");
  });

  it("RN-TRI-01: serviço com triagem abre na etapa de triagem", () => {
    const e = entrada("y", { estado: "confirmada", sessaoId: "s1" });
    const { dia } = aplicar(abrir(diaPlanejado({ exigeTriagem: true }), congelar([e]), INICIO));
    expect(dia.itens[0]?.etapa).toBe("triagem");
  });
});

describe("sessão pública (RN-PUB)", () => {
  const inicial = (vagas: number | null = 3): Estado => ({ sessao: publica({ vagas }), dia: null, entradas: [] });

  it("public: patient enrolls without the scheduler and is confirmed", () => {
    const st = inscrever(inicial(), "ana");
    const ana = ent(st, "ana");
    expect(ana.estado).toBe("confirmada");
    expect(ana.sessaoId).toBe("s1");
    expect(ana.riscoConfirmado).toBeNull(); // RN-RISCO-02: fica sugerido até a triagem
    expect(st.sessao.ocupadas).toBe(1);
    expect(sugerir(st.entradas, st.sessao, CONFIG_PADRAO, T)).toEqual([]);
    expect(listaDeLigacao(st.entradas, [st.sessao], CONFIG_PADRAO, T)).toEqual([]);
  });

  it("public: private session, emergency, duplicate and full are refused", () => {
    const cmd = (nome: string, extra: Partial<Parameters<typeof inscreverPublica>[2]> = {}) => ({
      servico: LIVRE,
      pessoa: { nome, nascimento: "1990-01-01", cpf: null },
      responsavelId: nome,
      respostas: respostas(),
      id: nome,
      entradasAtivas: [] as Entrada[],
      fotoAceita: false,
      ...extra,
    });
    expect(erro(inscreverPublica(sessaoVagas(), null, cmd("ana"), T))).toBe("transicao_proibida");
    const emergencia = cmd("ana", { respostas: respostas({ alarmes: ["dor_no_peito"] }) });
    expect(erro(inscreverPublica(publica({ vagas: 2 }), null, emergencia, T))).toBe("emergencia");

    let st = inscrever(inicial(2), "ana");
    expect(erro(inscreverPublica(st.sessao, null, cmd("ana", { id: "ana2", entradasAtivas: st.entradas }), T))).toBe(
      "duplicada",
    );
    st = inscrever(st, "joao");
    // RN-PUB-02 (substitui o "lotada" do protótipo): lotada vai para a reserva, sem ocupar vaga.
    st = inscrever(st, "bruno");
    expect(ent(st, "bruno").estado).toBe("na_reserva");
    expect(st.sessao.ocupadas).toBe(2);
  });

  it("public: day order follows enrollment time, with priority on top", () => {
    let st = inicial(5);
    st = inscrever(st, "joao", T);
    st = inscrever(st, "bruno", T + MIN);
    st = inscrever(st, "dora", T + 2 * MIN, { nascimento: "1950-01-01" });
    const sem = { ...CONFIG_PADRAO, janelaK: 0 }; // sem janela protegida, para isolar a ordem
    const r = abrirSessao(
      diaPlanejado({ config: sem }),
      st.sessao,
      st.entradas,
      { servico: LIVRE, fotosAceitas: [] },
      INICIO,
    );
    let dia = aplicar(r).dia;
    expect(dia.itens.map((i) => [i.entradaId, i.numero])).toEqual([
      ["joao", 1],
      ["bruno", 2],
      ["dora", 3],
    ]);
    for (const i of dia.itens) {
      dia = aplicar(conferirEMarcar(dia, { itemId: i.id, resultado: "confere" }, INICIO + MIN));
    }
    expect(elegiveis(dia, "e1")[0]?.entradaId).toBe("dora"); // idosa passa na frente de quem chegou antes
  });

  it("public: enrolling on the day of an open session enters the queue", () => {
    let st = inscrever(inicial(5), "joao");
    st = {
      ...st,
      ...aplicar(abrirSessao(diaPlanejado(), st.sessao, st.entradas, { servico: LIVRE, fotosAceitas: [] }, INICIO)),
    };
    st = inscrever(st, "ana", INICIO + 10 * MIN);
    expect(ent(st, "ana").estado).toBe("na_fila");
    const item = itemDe(st.dia, "ana");
    expect(item?.numero).toBe(2); // RN-FILA-02: próximo número livre
    expect(item?.estado).toBe("remoto");
    expect(st.sessao.ocupadas).toBe(2);
  });

  it("public: referral service reserves the slot until the referral is accepted", () => {
    let st: Estado = { sessao: publica({ servicoId: "car", vagas: 2 }), dia: null, entradas: [] };
    st = inscrever(st, "ana", T, { servico: REQUISICAO });
    expect(ent(st, "ana").estado).toBe("aguardando_encaminhamento");
    expect(ent(st, "ana").sessaoId).toBe("s1");
    expect(st.sessao.ocupadas).toBe(1); // a vaga fica guardada (vaga segura)
    const aceita = aplicar(aceitarRequisicao(ent(st, "ana"), null, T + H));
    expect(aceita.estado).toBe("confirmada");
    st = { ...st, entradas: st.entradas.map((e) => (e.id === "ana" ? aceita : e)) };

    // Sem aceite até a abertura, a vaga segura cai.
    st = inscrever(st, "joao", T + 2 * H, { servico: REQUISICAO });
    const dia0 = diaPlanejado({ servicoId: "car" });
    const r = aplicar(abrirSessao(dia0, st.sessao, st.entradas, { servico: REQUISICAO, fotosAceitas: [] }, INICIO));
    const joao = r.entradas.find((e) => e.id === "joao");
    expect([joao?.estado, joao?.sessaoId]).toEqual(["aguardando_encaminhamento", null]);
    expect(r.dia.itens.map((i) => i.entradaId)).toEqual(["ana"]);
    expect(r.sessao.ocupadas).toBe(1);
  });

  it("RN-ENC-04: requisição sem foto aceita com a sessão já aberta é recusada; com foto aceita entra", () => {
    let st: Estado = { sessao: publica({ servicoId: "car" }), dia: null, entradas: [] };
    const dia0 = diaPlanejado({ servicoId: "car" });
    st = { ...st, ...aplicar(abrirSessao(dia0, st.sessao, [], { servico: REQUISICAO, fotosAceitas: [] }, INICIO)) };
    const cmd = {
      servico: REQUISICAO,
      pessoa: { nome: "Ana", nascimento: "1990-01-01", cpf: null },
      responsavelId: "ana",
      respostas: respostas(),
      id: "ana",
      entradasAtivas: [] as Entrada[],
      fotoAceita: false,
    };
    expect(erro(inscreverPublica(st.sessao, st.dia, cmd, INICIO + MIN))).toBe("requisicao_pendente");
    st = inscrever(st, "ana", INICIO + MIN, { servico: REQUISICAO, fotoAceita: true });
    expect(ent(st, "ana").estado).toBe("na_fila");
  });
});

describe("lista de reserva (RN-PUB-02)", () => {
  const cheia = (): Estado => {
    let st: Estado = { sessao: publica({ vagas: 1 }), dia: null, entradas: [] };
    st = inscrever(st, "ana", T);
    st = inscrever(st, "bruno", T + MIN);
    st = inscrever(st, "carla", T + 2 * MIN);
    return st;
  };

  it("RN-PUB-02: lotada vai para a reserva; vaga liberada vai ao primeiro", () => {
    const st = cheia();
    expect(["ana", "bruno", "carla"].map((id) => ent(st, id).estado)).toEqual([
      "confirmada",
      "na_reserva",
      "na_reserva",
    ]);
    expect(st.sessao.ocupadas).toBe(1);

    // Ana cancela (o cancelamento é da Task 10); a vaga dela vai para Bruno.
    const semAna = st.entradas.map((e) => (e.id === "ana" ? { ...e, estado: "cancelada" as const } : e));
    const r = preencherDaReserva(livre(st.sessao), null, congelar(semAna), { servico: LIVRE, fotosAceitas: [] }, T + H);
    const { entradas, sessao } = aplicar(r);
    expect(entradas.find((e) => e.id === "bruno")?.estado).toBe("confirmada");
    expect(entradas.find((e) => e.id === "carla")?.estado).toBe("na_reserva");
    expect(sessao.ocupadas).toBe(1);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "inscrita", entradaId: "bruno" }));
  });

  it("RN-PUB-02: remanejado de sessão pública fica no topo da reserva", () => {
    const st = cheia();
    const entradas = st.entradas.map((e) =>
      e.id === "ana"
        ? { ...e, estado: "cancelada" as const }
        : e.id === "carla"
          ? { ...e, remanejada: "publica" as const }
          : e,
    );
    const { entradas: depois } = aplicar(
      preencherDaReserva(livre(st.sessao), null, congelar(entradas), { servico: LIVRE, fotosAceitas: [] }, T + H),
    );
    expect(depois.find((e) => e.id === "carla")?.estado).toBe("confirmada");
  });

  it("RN-PUB-02: com a sessão aberta, a vaga vai para a fila; sem foto passa ao próximo", () => {
    let st: Estado = { sessao: publica({ servicoId: "car", vagas: 1 }), dia: null, entradas: [] };
    st = inscrever(st, "ana", T, { servico: REQUISICAO, fotoAceita: true });
    st = inscrever(st, "bruno", T + MIN, { servico: REQUISICAO });
    st = inscrever(st, "carla", T + 2 * MIN, { servico: REQUISICAO });
    const dia0 = diaPlanejado({ servicoId: "car" });
    st = {
      ...st,
      ...aplicar(abrirSessao(dia0, st.sessao, st.entradas, { servico: REQUISICAO, fotosAceitas: [] }, INICIO)),
    };
    const semAna = st.entradas.map((e) => (e.id === "ana" ? { ...e, estado: "cancelada" as const } : e));
    const r = aplicar(
      preencherDaReserva(
        livre(st.sessao),
        st.dia,
        congelar(semAna),
        { servico: REQUISICAO, fotosAceitas: ["carla"] },
        INICIO + H,
      ),
    );
    expect(r.entradas.find((e) => e.id === "bruno")?.estado).toBe("na_reserva");
    expect(r.entradas.find((e) => e.id === "carla")?.estado).toBe("na_fila");
    expect(itemDe(r.dia, "carla")?.numero).toBe(2);
    expect(r.sessao.ocupadas).toBe(1);
  });

  it("RN-ENC-04: da reserva sem foto, antes da abertura, recebe como vaga segura", () => {
    let st: Estado = { sessao: publica({ servicoId: "car", vagas: 1 }), dia: null, entradas: [] };
    st = inscrever(st, "ana", T, { servico: REQUISICAO, fotoAceita: true });
    st = inscrever(st, "bruno", T + MIN, { servico: REQUISICAO });
    const semAna = st.entradas.map((e) => (e.id === "ana" ? { ...e, estado: "cancelada" as const } : e));
    const r = aplicar(
      preencherDaReserva(livre(st.sessao), null, congelar(semAna), { servico: REQUISICAO, fotosAceitas: [] }, T + H),
    );
    const bruno = r.entradas.find((e) => e.id === "bruno");
    expect([bruno?.estado, bruno?.sessaoId]).toEqual(["aguardando_encaminhamento", "s1"]);
    expect(r.sessao.ocupadas).toBe(1);
  });

  it("RN-PUB-02: troca de reserva por vaga cancela a reserva", () => {
    const st = cheia();
    const outra = publica({ id: "s2", inicio: INICIO + DIA, vagas: 2 });
    const r = trocarReserva(ent(st, "bruno"), outra, null, { servico: LIVRE, fotoAceita: false }, T + H);
    const { entrada: bruno, sessao } = aplicar(r);
    expect([bruno.estado, bruno.sessaoId]).toEqual(["confirmada", "s2"]);
    expect(bruno.dataEntradaOriginal).toBe(ent(st, "bruno").dataEntradaOriginal);
    expect(sessao.ocupadas).toBe(1);
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "cancelada", entradaId: "bruno", sessaoId: "s1" }),
    );

    // Só quem está na reserva troca; destino lotado, privado ou de outro serviço não.
    expect(erro(trocarReserva(ent(st, "ana"), outra, null, { servico: LIVRE, fotoAceita: false }, T))).toBe(
      "transicao_proibida",
    );
    const lotada = publica({ id: "s2", vagas: 1, ocupadas: 1 });
    expect(erro(trocarReserva(ent(st, "bruno"), lotada, null, { servico: LIVRE, fotoAceita: false }, T))).toBe(
      "sem_vaga",
    );
    const privada = sessaoVagas({ id: "s2" });
    expect(erro(trocarReserva(ent(st, "bruno"), privada, null, { servico: LIVRE, fotoAceita: false }, T))).toBe(
      "transicao_proibida",
    );
  });

  it("RN-PUB-02: troca para serviço com requisição, sem foto, guarda vaga segura", () => {
    let st: Estado = { sessao: publica({ servicoId: "car", vagas: 1 }), dia: null, entradas: [] };
    st = inscrever(st, "ana", T, { servico: REQUISICAO, fotoAceita: true });
    st = inscrever(st, "bruno", T + MIN, { servico: REQUISICAO });
    const outra = publica({ id: "s2", servicoId: "car", inicio: INICIO + DIA });
    const { entrada } = aplicar(
      trocarReserva(ent(st, "bruno"), outra, null, { servico: REQUISICAO, fotoAceita: false }, T),
    );
    expect([entrada.estado, entrada.sessaoId]).toEqual(["aguardando_encaminhamento", "s2"]);
  });
});

describe("vaga segura (RN-ENC-04)", () => {
  it("RN-ENC-04: vaga segura sem aceite é liberada na abertura", () => {
    let st: Estado = { sessao: publica({ servicoId: "car", vagas: 1 }), dia: null, entradas: [] };
    st = inscrever(st, "ana", T, { servico: REQUISICAO }); // vaga segura
    st = inscrever(st, "bruno", T + MIN, { servico: REQUISICAO, fotoAceita: true }); // reserva
    const dia0 = diaPlanejado({ servicoId: "car" });
    const r = abrirSessao(dia0, st.sessao, st.entradas, { servico: REQUISICAO, fotosAceitas: ["bruno"] }, INICIO);
    const { dia, entradas, sessao } = aplicar(r);
    const ana = entradas.find((e) => e.id === "ana");
    expect([ana?.estado, ana?.sessaoId]).toEqual(["aguardando_encaminhamento", null]);
    expect(entradas.find((e) => e.id === "bruno")?.estado).toBe("na_fila");
    expect(dia.itens.map((i) => i.entradaId)).toEqual(["bruno"]);
    expect(sessao.ocupadas).toBe(1);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "vaga_liberada", entradaId: "ana" }));
  });

  it("RN-ENC-04: aceite depois da abertura não vale; fora da vaga segura, aceite volta à lista", () => {
    const segura = entrada("a", { servicoId: "car", estado: "aguardando_encaminhamento", sessaoId: "s1" });
    const aberto = { ...diaPlanejado(), estado: "aberta" as const };
    expect(erro(aceitarRequisicao(segura, congelar(aberto), INICIO))).toBe("fora_do_prazo");
    const naLista = entrada("b", { servicoId: "car", estado: "aguardando_encaminhamento" });
    expect(aplicar(aceitarRequisicao(naLista, null, T)).estado).toBe("aguardando");
    expect(erro(aceitarRequisicao(entrada("c"), null, T))).toBe("transicao_proibida");
  });
});

describe("balcão (RN-FILA-03, RN-ENC-05)", () => {
  const aberto = (parcial: Partial<DiaSessao> = {}) => {
    const e = [
      entrada("ana", { estado: "confirmada", sessaoId: "s1" }),
      entrada("joao", { estado: "confirmada", sessaoId: "s1" }),
    ];
    return aplicar(abrir(diaPlanejado(parcial), congelar(e), INICIO));
  };
  const cmd = (nome: string, extra: Partial<Parameters<typeof incluirNoBalcao>[1]> = {}) => ({
    servico: LIVRE,
    sessao: sessaoVagas({ ocupadas: 2 }),
    pessoa: { nome, nascimento: "1960-05-05", cpf: null },
    respostas: respostas(),
    id: nome,
    entradasAtivas: [] as Entrada[],
    ...extra,
  });

  it("queue: front desk entry is present", () => {
    const { dia } = aberto();
    const r = incluirNoBalcao(dia, cmd("ze"), INICIO + MIN);
    const { dia: d2, sessao, entrada: ze } = aplicar(r);
    const item = itemDe(d2, "ze");
    expect([item?.estado, item?.numero, item?.senha]).toEqual(["presente", 3, "C-003"]);
    expect(ze.estado).toBe("na_fila");
    expect(ze.responsavelId).toBeNull(); // pessoa local
    expect(item?.prioridade.conferida).toBe(true); // a recepção conferiu na hora (idoso)
    expect(sessao.ocupadas).toBe(3);

    expect(erro(incluirNoBalcao(d2, cmd("outra", { sessao }), INICIO + 2 * MIN))).toBe("sem_vaga");
    const emerg = cmd("x", { sessao: sessaoVagas({ vagas: 5 }), respostas: respostas({ alarmes: ["convulsao"] }) });
    expect(erro(incluirNoBalcao(d2, emerg, INICIO))).toBe("emergencia");
    expect(erro(incluirNoBalcao(diaPlanejado(), cmd("y"), T))).toBe("sessao_fechada");
  });

  it("RN-FILA-03: a entrada do balcão passa pelo contrato de estados", () => {
    const linhas = TRANSICOES_ENTRADA.filter((t) => t.de === "—" && t.evento === "Recepção inclui no balcão");
    expect(linhas.map((t) => [t.para, t.spec])).toEqual([["na_fila", "marcacao"]]);
    expect(destinoPorCondicao("—", "Recepção inclui no balcão", () => true)).toBe("na_fila");
  });

  it("RN-ENC-05: balcão recusado em serviço regulado", () => {
    const { dia } = aberto({ servicoId: "reg" });
    expect(
      erro(incluirNoBalcao(dia, cmd("ze", { servico: REGULADO, sessao: sessaoVagas({ servicoId: "reg" }) }), INICIO)),
    ).toBe("servico_regulado");
  });
});

describe("lançamento regulado (RN-ENC-06)", () => {
  const privada = () => sessaoVagas({ servicoId: "reg" });
  const cmd = (extra: Partial<Parameters<typeof lancarRegulado>[2]> = {}) => ({
    servico: REGULADO,
    id: "ze",
    pessoa: { nome: "José", nascimento: "1950-03-03", cpf: "123.456.789-00" },
    contaId: "conta-ze",
    contaVerificada: true,
    entradasAtivas: [] as Entrada[],
    ...extra,
  });

  it("RN-ENC-06: lançamento entra confirmado; com sessão aberta, direto na fila", () => {
    const r = lancarRegulado(privada(), null, cmd({ riscoDaRegulacao: "atencao" }), T);
    const { entrada: ze, sessao } = aplicar(r);
    expect(ze.estado).toBe("confirmada");
    expect(ze.sessaoId).toBe("s1");
    expect(ze.riscoConfirmado).toBe("atencao"); // INV-07: gravado pelo agendador
    expect(ze.alocadaEm).toBeNull(); // sem prazo de confirmação
    expect(ze.responsavelId).toBe("conta-ze");
    expect(sessao.ocupadas).toBe(1);
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "lancada", dados: { push: true } }));
    expect(listaDeLigacao([ze], [sessao], CONFIG_PADRAO, T)).toEqual([]);
    expect(
      aplicar(
        lancarRegulado(
          privada(),
          null,
          cmd({ id: "z2", pessoa: { nome: "B", nascimento: "1990-01-01", cpf: null } }),
          T,
        ),
      ).entrada.riscoConfirmado,
    ).toBe("rotina");

    // Confirmado do lançamento entra na fila na abertura, sem liberação.
    const dia0 = diaPlanejado({ servicoId: "reg" });
    const aberto = aplicar(abrirSessao(dia0, sessao, congelar([ze]), { servico: REGULADO, fotosAceitas: [] }, INICIO));
    expect(itemDe(aberto.dia, "ze")?.numero).toBe(1);

    // No dia, com a sessão aberta: direto na fila remota com o próximo número.
    const r2 = lancarRegulado(
      aberto.sessao,
      aberto.dia,
      cmd({
        id: "ana",
        pessoa: { nome: "Ana", nascimento: "1990-01-01", cpf: "999" },
        entradasAtivas: aberto.entradas,
      }),
      INICIO + H,
    );
    const { entrada: ana, dia } = aplicar(r2);
    expect(ana.estado).toBe("na_fila");
    const item = itemDe(dia, "ana");
    expect([item?.estado, item?.numero, item?.senha]).toEqual(["remoto", 2, "C-002"]);
  });

  it("RN-ENC-06/RN-CONF-04: lançamento confirmado não é liberado na abertura", () => {
    const { entrada: ze, sessao } = aplicar(lancarRegulado(privada(), null, cmd(), T));
    const pend = pendentesNaAbertura(congelar([ze]), sessao);
    expect(aplicar(pend).entradas).toEqual([ze]);
    expect(aplicar(pend).sessao.ocupadas).toBe(1);
    expect(eventos(pend)).toEqual([]);
    const dia0 = diaPlanejado({ servicoId: "reg" });
    const ab = aplicar(abrirSessao(dia0, sessao, congelar([ze]), { servico: REGULADO, fotosAceitas: [] }, INICIO));
    expect(ab.entradas[0]?.estado).toBe("na_fila");
    expect(ab.sessao.ocupadas).toBe(1);
    expect(itemDe(ab.dia, "ze")?.estado).toBe("remoto");
  });

  it("RN-ENC-06/RN-FILA-05: lançamento com prioridade a conferir não é liberado; só o check-in espera a recepção", () => {
    // José (76 anos): idoso vem da data de nascimento no dia da sessão (AD-027) e não é pendência (F1).
    const { entrada: ze, sessao } = aplicar(lancarRegulado(privada(), null, cmd(), T));
    expect(ze.prioridade.grupos).toEqual([]);
    const dia0 = diaPlanejado({ servicoId: "reg" });
    const r = abrirSessao(dia0, sessao, congelar([ze]), { servico: REGULADO, fotosAceitas: [] }, INICIO);
    const ab = aplicar(r);
    expect(eventos(r).some((e) => e.tipo === "vaga_liberada")).toBe(false);
    expect([ab.entradas[0]?.estado, ab.sessao.ocupadas]).toEqual(["na_fila", 1]);
    const itemZe = itemDe(ab.dia, "ze");
    if (!itemZe) throw new Error("José fora da fila");
    expect(itemZe.prioridade.grupos).toEqual(["idoso"]);
    expect(erro(checkIn(ab.dia, { itemId: itemZe.id }, INICIO + 10 * MIN))).toBe("ok");

    // Com prioridade declarada ainda não conferida (PcD): a pendência só recusa o check-in.
    const pcd = congelar({ ...ze, prioridade: { grupos: ["pcd" as const], conferida: false, conferidaEm: null } });
    const ab2 = aplicar(abrirSessao(dia0, sessao, congelar([pcd]), { servico: REGULADO, fotosAceitas: [] }, INICIO));
    expect([ab2.entradas[0]?.estado, ab2.sessao.ocupadas]).toEqual(["na_fila", 1]);
    expect(erro(checkIn(ab2.dia, { itemId: itemZe.id }, INICIO + 10 * MIN))).toBe("pendencia");
    const conferido = aplicar(conferirEMarcar(ab2.dia, { itemId: itemZe.id, resultado: "confere" }, INICIO + 12 * MIN));
    expect(itemDe(conferido, "ze")?.estado).toBe("presente");
    expect(itemDe(conferido, "ze")?.prioridade.conferida).toBe(true);
  });

  it("RN-ENC-06/RN-LE-01: emergência informada pela regulação é recusada (não entra em fila)", () => {
    expect(erro(lancarRegulado(privada(), null, cmd({ riscoDaRegulacao: "emergencia" }), T))).toBe("emergencia");
  });

  it("RN-ENC-06: conta não verificada é tratada como sem app", () => {
    const r = lancarRegulado(privada(), null, cmd({ contaVerificada: false }), T);
    const { entrada: ze } = aplicar(r);
    expect(ze.responsavelId).toBeNull();
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "lancada", dados: { push: false } }));
    const semConta = lancarRegulado(privada(), null, cmd({ contaId: null, contaVerificada: false }), T);
    expect(aplicar(semConta).entrada.responsavelId).toBeNull();
  });

  it("RN-ENC-06: só em serviço regulado, sessão privada, com vaga e sem duplicata", () => {
    expect(erro(lancarRegulado(sessaoVagas(), null, cmd({ servico: LIVRE }), T))).toBe("transicao_proibida");
    expect(erro(lancarRegulado(sessaoVagas({ servicoId: "reg", visibilidade: "publica" }), null, cmd(), T))).toBe(
      "transicao_proibida",
    );
    expect(erro(lancarRegulado(sessaoVagas({ servicoId: "reg", ocupadas: 3 }), null, cmd(), T))).toBe("sem_vaga");
    const ja = aplicar(lancarRegulado(privada(), null, cmd(), T)).entrada;
    expect(erro(lancarRegulado(privada(), null, cmd({ id: "z2", entradasAtivas: [ja] }), T))).toBe("duplicada");
  });

  it("RN-ENC-06: agendador remove lançamento não chamado, com motivo", () => {
    const { entrada: ze, sessao } = aplicar(lancarRegulado(privada(), null, cmd(), T));
    const r = removerLancamento(ze, sessao, null, { servico: REGULADO, motivo: "CPF errado" }, T + H);
    const rem = aplicar(r);
    expect(rem.entrada.estado).toBe("cancelada");
    expect(rem.sessao.ocupadas).toBe(0);
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "removida", motivo: "CPF errado", dados: { push: true } }),
    );
    expect(eventos(r)).toContainEqual(expect.objectContaining({ tipo: "vaga_liberada" }));

    // Na fila e já chamado: não remove; remoto nunca chamado: sai da fila.
    const dia0 = diaPlanejado({ servicoId: "reg" });
    const ab = aplicar(abrirSessao(dia0, sessao, congelar([ze]), { servico: REGULADO, fotosAceitas: [] }, INICIO));
    const naFila = ab.entradas[0] as Entrada;
    const fora = aplicar(
      removerLancamento(naFila, ab.sessao, ab.dia, { servico: REGULADO, motivo: "regulação desmarcou" }, INICIO),
    );
    expect(itemDe(fora.dia, "ze")?.estado).toBe("saiu_da_fila");
    const chamado = congelar({
      ...ab.dia,
      chamadas: [{ itemId: idDoItem("ze", "s1"), etapa: "atendimento" as const, estacaoId: "e1", em: INICIO }],
    });
    expect(erro(removerLancamento(naFila, ab.sessao, chamado, { servico: REGULADO, motivo: "x" }, INICIO))).toBe(
      "transicao_proibida",
    );
  });
});

describe("invariantes", () => {
  it("INV-02: nenhum caminho passa das vagas", () => {
    // Pública cheia: inscrição vai para a reserva; liberar só preenche a vaga que abriu.
    let st: Estado = { sessao: publica({ vagas: 1 }), dia: null, entradas: [] };
    for (const [i, n] of ["a", "b", "c", "d"].entries()) st = inscrever(st, n, T + i * MIN);
    expect(st.sessao.ocupadas).toBe(1);
    const semA = st.entradas.map((e) => (e.id === "a" ? { ...e, estado: "cancelada" as const } : e));
    const lib = aplicar(
      preencherDaReserva(livre(st.sessao), null, congelar(semA), { servico: LIVRE, fotosAceitas: [] }, T + H),
    );
    expect(lib.sessao.ocupadas).toBe(1);
    expect(lib.entradas.filter((e) => e.estado === "confirmada")).toHaveLength(1);
    // Troca para sessão cheia, balcão e lançamento sem vaga: recusados.
    const cheia = publica({ id: "s2", vagas: 1, ocupadas: 1 });
    expect(erro(trocarReserva(ent(st, "c"), cheia, null, { servico: LIVRE, fotoAceita: false }, T))).toBe("sem_vaga");
    expect(
      erro(
        lancarRegulado(
          sessaoVagas({ servicoId: "reg", vagas: 1, ocupadas: 1 }),
          null,
          {
            servico: REGULADO,
            id: "z",
            pessoa: { nome: "Z", nascimento: "1990-01-01", cpf: null },
            contaId: null,
            contaVerificada: false,
            entradasAtivas: [],
          },
          T,
        ),
      ),
    ).toBe("sem_vaga");
    const diaAberto = congelar({ ...diaPlanejado(), estado: "aberta" as const });
    expect(
      erro(
        incluirNoBalcao(
          diaAberto,
          {
            servico: LIVRE,
            sessao: sessaoVagas({ vagas: 1, ocupadas: 1 }),
            pessoa: { nome: "Z", nascimento: "1990-01-01", cpf: null },
            respostas: respostas(),
            id: "z",
            entradasAtivas: [],
          },
          INICIO,
        ),
      ),
    ).toBe("sem_vaga");
  });

  it("INV-05: senha única na sessão, inclusive para quem entra depois da abertura", () => {
    let st: Estado = { sessao: publica({ vagas: 4 }), dia: null, entradas: [] };
    st = inscrever(st, "a", T);
    st = inscrever(st, "b", T + MIN);
    st = {
      ...st,
      ...aplicar(abrirSessao(diaPlanejado(), st.sessao, st.entradas, { servico: LIVRE, fotosAceitas: [] }, INICIO)),
    };
    st = inscrever(st, "c", INICIO + MIN); // inscrição no dia
    st = inscrever(st, "d", INICIO + 2 * MIN); // última vaga
    st = inscrever(st, "e", INICIO + 3 * MIN); // reserva
    const semB = st.entradas.map((e) => (e.id === "b" ? { ...e, estado: "cancelada" as const } : e));
    st = {
      ...st,
      ...aplicar(
        preencherDaReserva(livre(st.sessao), st.dia, congelar(semB), { servico: LIVRE, fotosAceitas: [] }, INICIO + H),
      ),
    };
    const semC = st.entradas.map((e) => (e.id === "c" ? { ...e, estado: "cancelada" as const } : e));
    const sessao = { ...st.sessao, ocupadas: st.sessao.ocupadas - 1 };
    const dia = st.dia as DiaSessao;
    const balcao = aplicar(
      incluirNoBalcao(
        dia,
        {
          servico: LIVRE,
          sessao,
          pessoa: { nome: "F", nascimento: "1990-01-01", cpf: null },
          respostas: respostas(),
          id: "f",
          entradasAtivas: semC,
        },
        INICIO + 2 * H,
      ),
    );
    const senhas = balcao.dia.itens.map((i) => i.senha);
    expect(senhas).toEqual(["C-001", "C-002", "C-003", "C-004", "C-005", "C-006"]);
    expect(new Set(senhas).size).toBe(senhas.length);
  });

  it("INV-05: id que já tem item na sessão aberta é recusado como duplicada, sem lançar", () => {
    const e = [entrada("ana", { estado: "confirmada", sessaoId: "s1", servicoId: "cli" })];
    const { dia } = aplicar(abrir(diaPlanejado(), congelar(e), INICIO));
    const outraPessoa = { nome: "Outra", nascimento: "1980-01-01", cpf: null };
    // Balcão com id repetido (pessoa diferente, então RN-LE-02 não pega).
    const balcao = incluirNoBalcao(
      dia,
      {
        servico: LIVRE,
        sessao: sessaoVagas({ ocupadas: 1 }),
        pessoa: outraPessoa,
        respostas: respostas(),
        id: "ana",
        entradasAtivas: [],
      },
      INICIO + MIN,
    );
    expect(erro(balcao)).toBe("duplicada");
    // Inscrição pública no dia com id repetido.
    const pub = inscreverPublica(
      publica({ ocupadas: 1 }),
      dia,
      {
        servico: LIVRE,
        pessoa: outraPessoa,
        responsavelId: "x",
        respostas: respostas(),
        id: "ana",
        entradasAtivas: [],
        fotoAceita: false,
      },
      INICIO + MIN,
    );
    expect(erro(pub)).toBe("duplicada");
    // Lançamento regulado no dia com id repetido.
    const diaReg = aplicar(
      abrir(
        diaPlanejado({ servicoId: "reg" }),
        congelar([entrada("ana", { estado: "confirmada", sessaoId: "s1", servicoId: "reg" })]),
        INICIO,
      ),
    ).dia;
    const lanc = lancarRegulado(
      sessaoVagas({ servicoId: "reg", ocupadas: 1 }),
      diaReg,
      {
        servico: REGULADO,
        id: "ana",
        pessoa: outraPessoa,
        contaId: null,
        contaVerificada: false,
        entradasAtivas: [],
      },
      INICIO + MIN,
    );
    expect(erro(lanc)).toBe("duplicada");
  });

  it("ações não alteram o que recebem", () => {
    // Todas as entradas dos testes acima são congeladas; aqui, o caminho completo com estado congelado.
    let st: Estado = congelar({ sessao: publica({ vagas: 1 }), dia: null, entradas: [] });
    st = inscrever(st, "a", T);
    st = inscrever(st, "b", T + MIN);
    expect(() =>
      abrirSessao(
        diaPlanejado(),
        congelar(st.sessao),
        congelar(st.entradas),
        { servico: LIVRE, fotosAceitas: [] },
        INICIO,
      ),
    ).not.toThrow();
  });
});

describe("AD-010: quem entra na fila com a sessão aberta", () => {
  const E1 = { estacaoId: "e1" };
  const ATENCAO = problemaNovo("moderado");

  /** Bruno (rotina) inscrito antes, sessão aberta às 07:00 e Bruno chamado às 07:01. */
  function brunoChamado(vagas: number): Estado {
    let st: Estado = { sessao: publica({ vagas }), dia: null, entradas: [] };
    st = inscrever(st, "bruno", T);
    st = {
      ...st,
      ...aplicar(abrirSessao(diaPlanejado(), st.sessao, st.entradas, { servico: LIVRE, fotosAceitas: [] }, INICIO)),
    };
    const brunoItem = itemDe(st.dia, "bruno");
    if (!brunoItem || !st.dia) throw new Error("Bruno fora da fila");
    let dia = aplicar(checkIn(st.dia, { itemId: brunoItem.id }, INICIO));
    dia = aplicar(chamarProximo(dia, E1, INICIO + MIN));
    return { ...st, dia };
  }

  /** Zé (atenção, antes de Bruno na ordem) se inscreve na sessão aberta. */
  function zeInscreve(st: Estado, agora: number): Estado {
    const {
      entrada: ze,
      sessao,
      dia,
    } = aplicar(
      inscreverPublica(
        st.sessao,
        st.dia,
        {
          servico: LIVRE,
          pessoa: { nome: "Zé", nascimento: "1990-01-01", cpf: null },
          responsavelId: "ze",
          respostas: ATENCAO,
          id: "ze",
          entradasAtivas: st.entradas,
          fotoAceita: false,
        },
        agora,
      ),
    );
    return { sessao, dia, entradas: [...st.entradas, ze] };
  }

  const diaDe = (st: Estado): DiaSessao => {
    if (!st.dia) throw new Error("sem dia");
    return st.dia;
  };

  it("AD-010: inscrito com a sessão aberta não perde a vez por chamadas anteriores à inscrição (check-in)", () => {
    const st = zeInscreve(brunoChamado(3), INICIO + H);
    const ze = itemDe(st.dia, "ze");
    expect(ze?.numero).toBe(2);
    const r = checkIn(diaDe(st), { itemId: idDoItem("ze", "s1") }, INICIO + 90 * MIN);
    expect(itemDe(aplicar(r), "ze")).toMatchObject({ estado: "presente", numero: 2 });
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "presente", dados: expect.objectContaining({ perdeuAVez: false }) }),
    );
  });

  it("AD-010/RN-SES-02: inscrito com a sessão aberta que não veio é remanejado, não faltoso", () => {
    const st = zeInscreve(brunoChamado(3), INICIO + H);
    const dia = aplicar(finalizar(diaDe(st), E1, INICIO + 2 * H));
    const fim = aplicar(
      encerrar(dia, st.entradas, INICIO + 3 * H, { semSinalSemContingencia: false, origem: "publica" }),
    );
    expect(fim.dia.encerramento?.faltas).toEqual([]);
    expect(itemDe(fim.dia, "ze")?.estado).toBe("remanejado");
    expect(fim.entradas.find((e) => e.id === "ze")?.estado).toBe("remanejada");
  });

  it("AD-010: vaga da reserva preenchida com a sessão aberta não perde a vez por chamadas anteriores", () => {
    // Uma vaga só: Zé vai para a reserva; Bruno é chamado; a vaga da Carla abre às 08:00.
    let st: Estado = { sessao: publica({ vagas: 2 }), dia: null, entradas: [] };
    st = inscrever(st, "bruno", T);
    st = inscrever(st, "carla", T + MIN);
    st = zeInscreve(st, T + 2 * MIN);
    expect(ent(st, "ze").estado).toBe("na_reserva");
    st = {
      ...st,
      ...aplicar(abrirSessao(diaPlanejado(), st.sessao, st.entradas, { servico: LIVRE, fotosAceitas: [] }, INICIO)),
    };
    let dia = aplicar(checkIn(diaDe(st), { itemId: idDoItem("bruno", "s1") }, INICIO));
    dia = aplicar(chamarProximo(dia, E1, INICIO + MIN));
    const semCarla = st.entradas.map((e) => (e.id === "carla" ? { ...e, estado: "cancelada" as const } : e));
    const rs = aplicar(
      preencherDaReserva(livre(st.sessao), dia, congelar(semCarla), { servico: LIVRE, fotosAceitas: [] }, INICIO + H),
    );
    expect(rs.entradas.find((e) => e.id === "ze")?.estado).toBe("na_fila");
    const r = checkIn(diaDe(rs), { itemId: idDoItem("ze", "s1") }, INICIO + 90 * MIN);
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "presente", dados: expect.objectContaining({ perdeuAVez: false }) }),
    );
  });

  it("AD-010: lançamento regulado com a sessão aberta não perde a vez por chamadas anteriores", () => {
    const diaReg = diaPlanejado({
      servicoId: "reg",
      estacoes: [{ id: "e1", etapa: "atendimento", servicos: ["reg"], aberta: true, chamadoItemId: null }],
    });
    const lancar = (
      s: SessaoVagas,
      d: DiaSessao | null,
      id: string,
      risco: "rotina" | "atencao",
      agora: number,
      ativas: Entrada[],
    ) =>
      aplicar(
        lancarRegulado(
          s,
          d,
          {
            servico: REGULADO,
            id,
            pessoa: { nome: id, nascimento: "1990-01-01", cpf: null },
            contaId: null,
            contaVerificada: false,
            riscoDaRegulacao: risco,
            entradasAtivas: ativas,
          },
          agora,
        ),
      );
    const bruno = lancar(sessaoVagas({ servicoId: "reg" }), null, "bruno", "rotina", T, []);
    const ab = aplicar(
      abrirSessao(diaReg, bruno.sessao, congelar([bruno.entrada]), { servico: REGULADO, fotosAceitas: [] }, INICIO),
    );
    let dia = aplicar(checkIn(ab.dia, { itemId: idDoItem("bruno", "s1") }, INICIO));
    dia = aplicar(chamarProximo(dia, E1, INICIO + MIN));
    const ze = lancar(ab.sessao, dia, "ze", "atencao", INICIO + H, ab.entradas);
    if (!ze.dia) throw new Error("sem dia");
    const r = checkIn(ze.dia, { itemId: idDoItem("ze", "s1") }, INICIO + 90 * MIN);
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "presente", dados: expect.objectContaining({ perdeuAVez: false }) }),
    );
  });
});

describe("I1: prioridade montada no dia de cada sessão (AD-024, AD-027, RN-RISCO-04)", () => {
  /** Abre a sessão "s1" com a entrada confirmada e devolve o item dela. */
  const itemNaAbertura = (e: Entrada, agora: number, config = CONFIG_PADRAO) => {
    const conf = congelar({ ...e, estado: "confirmada" as const, sessaoId: "s1" });
    const r = aplicar(abrir(diaPlanejado({ config }), [conf], agora));
    const item = itemDe(r.dia, e.id);
    if (!item) throw new Error("sem item");
    return { dia: r.dia, item };
  };
  /** 13/11/2026 00:30 e 12/11/2026 23:30 em Brasília (UTC-3). */
  const POS_MEIA_NOITE = Date.UTC(2026, 10, 13, 3, 30);
  const PRE_MEIA_NOITE = Date.UTC(2026, 10, 13, 2, 30);

  it("AD-027: quem faz 60 anos entre a entrada na lista e a sessão entra como idoso (fuso da unidade)", () => {
    const e = entrada("ze", {
      pessoa: { nome: "Zé", nascimento: "1966-11-13", cpf: null },
      dataEntradaOriginal: T - 90 * DIA,
    });
    expect(itemNaAbertura(e, POS_MEIA_NOITE).item.prioridade.grupos).toEqual(["idoso"]);
    expect(itemNaAbertura(e, PRE_MEIA_NOITE).item.prioridade.grupos).toEqual([]);
  });

  it("AD-027: quem faz 80 anos na espera passa a idoso80 (80+ antes dos demais)", () => {
    const e = entrada("dora", {
      pessoa: { nome: "Dora", nascimento: "1946-11-13", cpf: null },
      prioridade: { grupos: ["pcd"], conferida: true, conferidaEm: T - 90 * DIA },
    });
    expect(itemNaAbertura(e, POS_MEIA_NOITE).item.prioridade.grupos).toEqual(["idoso80", "pcd"]);
    expect(itemNaAbertura(e, PRE_MEIA_NOITE).item.prioridade.grupos).toEqual(["idoso", "pcd"]);
  });

  it("RN-FILA-05/F1: idoso sem outra prioridade faz check-in sem passar na recepção", () => {
    const e = entrada("ze", { pessoa: { nome: "Zé", nascimento: "1950-01-01", cpf: null } });
    const { dia, item } = itemNaAbertura(e, INICIO);
    expect(item.prioridade.grupos).toEqual(["idoso"]);
    expect(itemDe(aplicar(checkIn(dia, { itemId: item.id }, INICIO + MIN)), "ze")?.estado).toBe("presente");
  });

  it("AD-024: conferida na recepção, vale nas próximas idas; com prazo, expira e volta a ser conferida", () => {
    const gestante = entrada("bia", { prioridade: { grupos: ["gestante"], conferida: false, conferidaEm: null } });
    const ida1 = itemNaAbertura(gestante, INICIO);
    expect(erro(checkIn(ida1.dia, { itemId: ida1.item.id }, INICIO + MIN))).toBe("pendencia");
    const conferido = aplicar(
      conferirEMarcar(ida1.dia, { itemId: ida1.item.id, resultado: "confere" }, INICIO + 2 * MIN),
    );
    const itemConferido = itemDe(conferido, "bia");
    if (!itemConferido) throw new Error("sem item");
    const guardada = conferenciaNaEntrada(gestante, itemConferido);
    expect(guardada.prioridade).toEqual({ grupos: ["gestante"], conferida: true, conferidaEm: INICIO + 2 * MIN });

    // Próxima ida, 20 dias depois: já conferida, check-in direto.
    const ida2 = itemNaAbertura(guardada, INICIO + 20 * DIA);
    expect(erro(checkIn(ida2.dia, { itemId: ida2.item.id }, INICIO + 20 * DIA + MIN))).toBe("ok");
    // Com prazo de 30 dias (D5, configuração): na ida de 40 dias depois, expirou.
    const comPrazo = { ...CONFIG_PADRAO, prazosPrioridade: { gestante: 30 } };
    const ida3 = itemNaAbertura(guardada, INICIO + 40 * DIA, comPrazo);
    expect(erro(checkIn(ida3.dia, { itemId: ida3.item.id }, INICIO + 40 * DIA + MIN))).toBe("pendencia");
  });

  it("RN-RISCO-04: prioridade não conferida é retirada da entrada; a idade continua valendo", () => {
    const e = entrada("ze", {
      pessoa: { nome: "Zé", nascimento: "1950-01-01", cpf: null },
      prioridade: { grupos: ["pcd"], conferida: false, conferidaEm: null },
    });
    const { dia, item } = itemNaAbertura(e, INICIO);
    const d = aplicar(conferirEMarcar(dia, { itemId: item.id, resultado: "prioridade_nao_confere" }, INICIO + MIN));
    const depois = itemDe(d, "ze");
    if (!depois) throw new Error("sem item");
    expect(depois.prioridade.grupos).toEqual(["idoso"]);
    expect(conferenciaNaEntrada(e, depois).prioridade.grupos).toEqual([]);
  });
});

describe("RN-RISCO-03: refazer o questionário", () => {
  const URGENTE = problemaNovo("forte");

  it("RN-RISCO-03: subir para urgente alerta o agendador; emergência orienta o 192", () => {
    const e = entrada("ana");
    const r = refazerQuestionario(e, null, { respostas: URGENTE }, T);
    expect(aplicar(r).entrada.classificacao.nivel).toBe("urgente");
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "alerta_agendador", entradaId: "ana", motivo: "Problema novo forte" }),
    );
    // Já urgente: não alerta de novo.
    const ja = aplicar(r).entrada;
    expect(
      eventos(refazerQuestionario(ja, null, { respostas: URGENTE }, T)).some((x) => x.tipo === "alerta_agendador"),
    ).toBe(false);
    expect(erro(refazerQuestionario(e, null, { respostas: respostas({ alarmes: ["dor_no_peito"] }) }, T))).toBe(
      "emergencia",
    );
    // Só enquanto espera: entrada final não refaz.
    expect(erro(refazerQuestionario(entrada("x", { estado: "concluida" }), null, { respostas: URGENTE }, T))).toBe(
      "transicao_proibida",
    );
  });

  it("RN-RISCO-03: na fila do dia, o item remoto passa a usar o risco sugerido novo", () => {
    const conf = entrada("ana", { estado: "confirmada", sessaoId: "s1" });
    const outro = entrada("bruno", { estado: "confirmada", sessaoId: "s1", dataEntradaOriginal: T - 30 * DIA });
    const ab = aplicar(abrir(diaPlanejado(), congelar([outro, conf]), INICIO));
    const naFila = ab.entradas.find((x) => x.id === "ana") as Entrada;
    const r = refazerQuestionario(naFila, ab.dia, { respostas: URGENTE }, INICIO + MIN);
    const { dia } = aplicar(r);
    expect(itemDe(dia, "ana")).toMatchObject({ risco: "urgente", urgenciaConfirmada: false });
    expect(eventos(r)).toContainEqual(
      expect.objectContaining({ tipo: "risco_sugerido", itemId: idDoItem("ana", "s1"), dados: { nivel: "urgente" } }),
    );
    // Risco confirmado (agendador ou triagem) vale sobre o sugerido: o item não muda.
    const confirmada = { ...naFila, riscoConfirmado: "rotina" as const };
    expect(
      itemDe(aplicar(refazerQuestionario(confirmada, ab.dia, { respostas: URGENTE }, INICIO + MIN)).dia, "ana")?.risco,
    ).toBe("rotina");
    // Presente: segue no lugar com o risco que tinha; só a entrada muda.
    const presente = aplicar(checkIn(ab.dia, { itemId: idDoItem("ana", "s1") }, INICIO + MIN));
    const p = aplicar(refazerQuestionario(naFila, presente, { respostas: URGENTE }, INICIO + 2 * MIN));
    expect(itemDe(p.dia, "ana")?.risco).toBe("rotina");
    expect(p.entrada.classificacao.nivel).toBe("urgente");
  });
});
