import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "../src/fila.ts";
import {
  alocar,
  arquivar,
  confirmar,
  criarEntrada,
  type Entrada,
  entradaAtivaDa,
  listaDeLigacao,
  pendentesNaAbertura,
  perguntarAindaPrecisa,
  prazoConfirmacao,
  prioridadeDaEntrada,
  reativar,
  recusar,
  responderAindaPrecisa,
  type Servico,
  type SessaoVagas,
  sugerir,
} from "../src/lista.ts";
import type { Resultado } from "../src/resultado.ts";
import { congelar, entrada, problemaNovo, respostas, sessaoVagas } from "./fixtures.ts";

const MIN = 60_000;
const H = 60 * MIN;
const DIA = 24 * H;
/** 12/11/2026 07:00 em Brasília (UTC-3, sem horário de verão). */
const T = Date.UTC(2026, 10, 12, 10, 0);

const LIVRE: Servico = congelar({ id: "cli", modo: "livre", exigeTriagem: false });
const REQUISICAO: Servico = congelar({ id: "car", modo: "requisicao", exigeTriagem: false });
const REGULADO: Servico = congelar({ id: "reg", modo: "regulado", exigeTriagem: false });

const pessoa = (nome: string, parcial: Partial<Entrada["pessoa"]> = {}): Entrada["pessoa"] => ({
  nome,
  nascimento: "1990-01-01",
  cpf: null,
  ...parcial,
});

function aplicar<E>(r: Resultado<E>): E {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return congelar(r.estado);
}

function eventos<E>(r: Resultado<E>) {
  if (!r.ok) throw new Error(`ação recusada: ${r.erro}`);
  return r.eventos;
}

const criar = (ativas: Entrada[], cmd: Partial<Parameters<typeof criarEntrada>[1]> = {}, agora = T) =>
  criarEntrada(
    congelar(ativas),
    {
      servico: LIVRE,
      pessoa: pessoa("Ana"),
      responsavelId: "ana",
      respostas: respostas(),
      id: "nova",
      ...cmd,
    },
    agora,
  );

const alocada = (e: Entrada, s: SessaoVagas, agora = T) => aplicar(alocar(e, s, {}, agora));

describe("entrada na lista", () => {
  it("waitlist: one active entry per service (RN-LE-02)", () => {
    const primeira = aplicar(criar([], { id: "e1" }));
    expect(primeira.estado).toBe("aguardando");

    const denovo = criar([primeira], { id: "e2" });
    expect(denovo).toEqual({ ok: false, erro: "duplicada" });
    expect(entradaAtivaDa([primeira], pessoa("Ana"), "cli")?.id).toBe("e1");

    const outroServico = aplicar(criar([primeira], { id: "e3", servico: REQUISICAO }));
    expect(outroServico.servicoId).toBe("car");

    // Finais e arquivadas não contam como ativas.
    for (const estado of ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"] as const) {
      expect(criar([{ ...primeira, estado }], { id: "e4" }).ok).toBe(true);
    }
  });

  it("RN-LE-05: duplicidade pela pessoa atendida (CPF ou nome + nascimento)", () => {
    const comCpf = aplicar(criar([], { id: "e1", pessoa: pessoa("Ana Souza", { cpf: "123.456.789-09" }) }));
    // Mesmo CPF, outro nome e outro responsável: é a mesma pessoa.
    expect(
      criar([comCpf], { id: "e2", responsavelId: "mae", pessoa: pessoa("Ana S.", { cpf: "12345678909" }) }),
    ).toEqual({ ok: false, erro: "duplicada" });
    // CPFs diferentes com o mesmo nome e nascimento: pessoas diferentes.
    expect(criar([comCpf], { id: "e3", pessoa: pessoa("Ana Souza", { cpf: "98765432100" }) }).ok).toBe(true);

    const semCpf = aplicar(criar([], { id: "e4", pessoa: pessoa("Bebê da Ana", { nascimento: "2026-01-10" }) }));
    // Sem CPF: nome (sem diferença de caixa, acento ou espaços) + nascimento.
    expect(
      criar([semCpf], {
        id: "e5",
        responsavelId: "pai",
        pessoa: pessoa("  bebe da  ANA ", { nascimento: "2026-01-10" }),
      }),
    ).toEqual({ ok: false, erro: "duplicada" });
    expect(criar([semCpf], { id: "e6", pessoa: pessoa("Bebê da Ana", { nascimento: "2026-01-11" }) }).ok).toBe(true);
    // Um lado sem CPF: compara nome + nascimento.
    expect(criar([comCpf], { id: "e7", pessoa: pessoa("Ana Souza") })).toEqual({ ok: false, erro: "duplicada" });
  });

  it("RN-LE-01: serviço regulado recusa entrada pelo app", () => {
    expect(criar([], { servico: REGULADO })).toEqual({ ok: false, erro: "servico_regulado" });
  });

  it("RN-LE-01: serviço com requisição entra aguardando encaminhamento", () => {
    expect(aplicar(criar([], { servico: REQUISICAO })).estado).toBe("aguardando_encaminhamento");
  });

  it("emergência não cria entrada (mostra 192)", () => {
    expect(criar([], { respostas: respostas({ alarmes: ["dor_no_peito"] }) })).toEqual({
      ok: false,
      erro: "emergencia",
    });
  });

  it("RN-LE-03/RN-LE-05: grava data original, classificação e prioridade da pessoa atendida", () => {
    const r = criar([], {
      id: "e1",
      responsavelId: "filha",
      pessoa: pessoa("Dora", { nascimento: "1944-03-01" }),
      respostas: problemaNovo("forte", { grupos: ["pcd"] }),
    });
    const e = aplicar(r);
    expect(e).toMatchObject({
      id: "e1",
      servicoId: "cli",
      responsavelId: "filha",
      estado: "aguardando",
      dataEntradaOriginal: T,
      classificacao: { nivel: "urgente", regra: "Problema novo forte" },
      riscoConfirmado: null,
      // Só os grupos declarados ficam na entrada; idoso vem da data de nascimento em cada uso (AD-027).
      prioridade: { grupos: ["pcd"], conferida: false, conferidaEm: null },
      remanejada: null,
      recusas: 0,
      sessaoId: null,
      alocadaEm: null,
      perguntadoEm: null,
    });
    // Urgente sugerido: alerta ao agendador (tabela da classificação).
    expect(eventos(r).map((ev) => ev.tipo)).toEqual(["entrada_criada", "alerta_agendador"]);
  });
});

describe("sugestão de alocação", () => {
  const dias = (n: number) => T - n * DIA;

  it("allocation: suggestion order and reasons (RN-AL-01, RN-AL-02)", () => {
    const rotinaAntiga = entrada("ana", { dataEntradaOriginal: dias(50) });
    const urgConfirmada = entrada("joao", { dataEntradaOriginal: dias(10), riscoConfirmado: "urgente" });
    const atencao = entrada("bruno", {
      dataEntradaOriginal: dias(5),
      classificacao: { nivel: "atencao", regra: "Problema novo moderado", apoio: false },
    });
    const dora = entrada("dora", {
      dataEntradaOriginal: dias(20),
      pessoa: pessoa("Dora", { nascimento: "1944-03-01" }),
      prioridade: { grupos: ["idoso80"], conferida: false, conferidaEm: null },
    });
    const remanejada = entrada("edu", { dataEntradaOriginal: dias(1), estado: "remanejada", remanejada: "privada" });
    const seuZe = entrada("ze", {
      dataEntradaOriginal: dias(90),
      pessoa: pessoa("Seu Zé", { nascimento: "1956-01-01" }),
      prioridade: { grupos: ["idoso"], conferida: false, conferidaEm: null },
    });
    const todas = congelar([rotinaAntiga, urgConfirmada, atencao, dora, remanejada, seuZe]);
    const s = sessaoVagas({ vagas: 10 });

    const sugestao = sugerir(todas, s, CONFIG_PADRAO, T);
    // 80+ antes de 60-79 com o mesmo risco, mesmo esperando há menos tempo.
    expect(sugestao.map((x) => x.entradaId)).toEqual(["joao", "edu", "bruno", "dora", "ze", "ana"]);
    const motivos = (id: string) => sugestao.find((x) => x.entradaId === id)?.motivos ?? [];
    expect(motivos("dora")).toEqual(["rotina sugerido", "pessoa idosa, 82 anos", "espera há 20 dias"]);
    expect(motivos("joao")).toEqual(["urgente confirmado", "espera há 10 dias"]);
    expect(motivos("edu")).toEqual(["rotina sugerido", "remanejada", "espera há 1 dias"]);

    // Município com prioridade legal antes do risco.
    const porPrioridade = sugerir(todas, s, { ...CONFIG_PADRAO, ordemMunicipio: "prioridade" }, T);
    expect(porPrioridade.map((x) => x.entradaId)).toEqual(["joao", "edu", "dora", "ze", "bruno", "ana"]);
  });

  it("RN-AL-02: empate total desempata pela data original e depois pelo id", () => {
    const todas = congelar([
      entrada("c", { dataEntradaOriginal: dias(3) }),
      entrada("b", { dataEntradaOriginal: dias(5) }),
      entrada("a", { dataEntradaOriginal: dias(3) }),
    ]);
    expect(sugerir(todas, sessaoVagas(), CONFIG_PADRAO, T).map((x) => x.entradaId)).toEqual(["b", "a", "c"]);
  });

  it("só sugere entradas aguardando ou remanejadas do serviço da sessão", () => {
    const todas = congelar([
      entrada("ok"),
      entrada("outro", { servicoId: "car" }),
      entrada("enc", { estado: "aguardando_encaminhamento" }),
      entrada("aloc", { estado: "alocada", sessaoId: "s2" }),
      entrada("arq", { estado: "arquivada" }),
      entrada("recusou", { sessoesRecusadas: ["s1"] }),
    ]);
    expect(sugerir(todas, sessaoVagas(), CONFIG_PADRAO, T).map((x) => x.entradaId)).toEqual(["ok"]);
  });
});

describe("alocação", () => {
  it("allocation: never exceeds slots (RN-AL-06, INV-02)", () => {
    const cheia = sessaoVagas({ vagas: 3, ocupadas: 3 });
    expect(alocar(entrada("a"), cheia, {}, T)).toEqual({ ok: false, erro: "sem_vaga" });

    const r = aplicar(alocar(entrada("a"), sessaoVagas({ vagas: 3, ocupadas: 2 }), {}, T));
    expect(r.sessao.ocupadas).toBe(3);
    expect(alocar(entrada("b"), r.sessao, {}, T)).toEqual({ ok: false, erro: "sem_vaga" });

    // Sem limite de vagas configurado.
    expect(alocar(entrada("a"), sessaoVagas({ vagas: null, ocupadas: 500 }), {}, T).ok).toBe(true);
  });

  it("RN-RISCO-01: alocar grava o nível como confirmado, e o agendador pode alterá-lo", () => {
    const s = sessaoVagas();
    const r = alocar(entrada("a"), s, {}, T);
    const { entrada: e, sessao } = aplicar(r);
    expect(e).toMatchObject({ estado: "alocada", sessaoId: "s1", alocadaEm: T, riscoConfirmado: "rotina" });
    expect(sessao.ocupadas).toBe(1);
    expect(eventos(r)).toEqual([{ tipo: "alocada", entradaId: "a", sessaoId: "s1", dados: { prazo: T + 24 * H } }]);

    expect(aplicar(alocar(entrada("b"), s, { riscoConfirmado: "atencao" }, T)).entrada.riscoConfirmado).toBe("atencao");
    // Confirmado antes (ex.: triagem) é mantido se o agendador não altera.
    expect(aplicar(alocar(entrada("c", { riscoConfirmado: "urgente" }), s, {}, T)).entrada.riscoConfirmado).toBe(
      "urgente",
    );
  });

  it("remanejada pode ser alocada; outros estados e outro serviço não", () => {
    const s = sessaoVagas();
    expect(alocar(entrada("r", { estado: "remanejada", remanejada: "privada" }), s, {}, T).ok).toBe(true);
    for (const estado of ["alocada", "confirmada", "aguardando_encaminhamento", "arquivada", "cancelada"] as const) {
      expect(alocar(entrada("x", { estado }), s, {}, T)).toEqual({ ok: false, erro: "transicao_proibida" });
    }
    expect(alocar(entrada("x", { servicoId: "car" }), s, {}, T)).toEqual({ ok: false, erro: "transicao_proibida" });
    expect(alocar(entrada("x"), sessaoVagas({ visibilidade: "publica" }), {}, T)).toEqual({
      ok: false,
      erro: "transicao_proibida",
    });
  });

  it("RN-AL-05: aloca até as 23:59 da véspera no fuso; às 00:00 do dia da sessão, não", () => {
    const s = sessaoVagas(); // 13/11 07:00 em Brasília
    const vespera2359 = Date.UTC(2026, 10, 13, 2, 59); // 12/11 23:59 em Brasília (13/11 em UTC)
    const dia0000 = Date.UTC(2026, 10, 13, 3, 0); // 13/11 00:00 em Brasília
    expect(alocar(entrada("a"), s, {}, vespera2359).ok).toBe(true);
    expect(alocar(entrada("a"), s, {}, dia0000)).toEqual({ ok: false, erro: "fora_do_prazo" });
    expect(alocar(entrada("a"), s, {}, s.inicio + H)).toEqual({ ok: false, erro: "fora_do_prazo" });
    // Outro fuso: em Manaus (UTC-4) ainda são 23:00 da véspera às 03:00 UTC.
    const manaus = { ...CONFIG_PADRAO, fuso: "America/Manaus" };
    const sManaus = sessaoVagas({ inicio: Date.UTC(2026, 10, 13, 11, 0) });
    expect(alocar(entrada("a"), sManaus, {}, dia0000, manaus).ok).toBe(true);
    expect(alocar(entrada("a"), sManaus, {}, Date.UTC(2026, 10, 13, 4, 0), manaus)).toEqual({
      ok: false,
      erro: "fora_do_prazo",
    });
  });
});

describe("confirmação", () => {
  it("calllist: pending allocation highlighted after 24 h (RN-CONF-01, RN-CONF-03)", () => {
    const s = sessaoVagas({ inicio: T + 3 * DIA });
    const { entrada: e, sessao } = alocada(entrada("ana"), s);
    expect(prazoConfirmacao(e, sessao, CONFIG_PADRAO)).toBe(T + 24 * H);

    const lista = (agora: number, entradas = [e]) => listaDeLigacao(entradas, [sessao], CONFIG_PADRAO, agora);
    expect(lista(T)).toEqual([{ entradaId: "ana", sessaoId: "s1", prazo: T + 24 * H, destacada: false }]);
    expect(lista(T + 24 * H - MIN)[0]?.destacada).toBe(false);
    expect(lista(T + 24 * H)[0]?.destacada).toBe(true);

    // Depois das 24 h, ainda dá para confirmar até a abertura (o agendador liga).
    const conf = confirmar(e, sessao, T + 24 * H);
    const confirmada = aplicar(conf);
    expect(confirmada.estado).toBe("confirmada");
    expect(eventos(conf)).toEqual([{ tipo: "confirmada", entradaId: "ana", sessaoId: "s1" }]);
    expect(lista(T + 24 * H, [confirmada])).toEqual([]);
  });

  it("calllist: deadline is the session start when it comes before 24 h", () => {
    const inicio = Date.UTC(2026, 10, 13, 8, 0); // 13/11 05:00 em Brasília
    const s = sessaoVagas({ inicio });
    const alocadaAs = Date.UTC(2026, 10, 13, 1, 0); // 12/11 22:00 em Brasília (véspera)
    const { entrada: e, sessao } = alocada(entrada("ana"), s, alocadaAs);
    expect(prazoConfirmacao(e, sessao, CONFIG_PADRAO)).toBe(inicio);
    const lista = (agora: number) => listaDeLigacao([e], [sessao], CONFIG_PADRAO, agora)[0]?.destacada;
    expect(lista(inicio - MIN)).toBe(false);
    expect(lista(inicio)).toBe(true);
  });

  it("RN-CONF-03: lista de ligação só tem alocadas, pela sessão mais próxima", () => {
    const perto = sessaoVagas({ id: "perto", inicio: T + 2 * DIA });
    const longe = sessaoVagas({ id: "longe", inicio: T + 5 * DIA });
    const a = alocada(entrada("a"), longe).entrada;
    const b = alocada(entrada("b"), perto).entrada;
    const lista = listaDeLigacao(congelar([a, b, entrada("c")]), [longe, perto], CONFIG_PADRAO, T);
    expect(lista.map((x) => x.entradaId)).toEqual(["b", "a"]);
  });

  it("confirmar: só alocada nesta sessão e antes da abertura", () => {
    const { entrada: e, sessao } = alocada(entrada("a"), sessaoVagas());
    expect(confirmar(e, sessao, sessao.inicio - 1).ok).toBe(true);
    expect(confirmar(e, sessao, sessao.inicio)).toEqual({ ok: false, erro: "fora_do_prazo" });
    expect(confirmar(entrada("x"), sessao, T)).toEqual({ ok: false, erro: "transicao_proibida" });
    expect(confirmar(e, sessaoVagas({ id: "s2" }), T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("allocation: refusal keeps original date (RN-CONF-04, INV-09)", () => {
    const original = T - 30 * DIA;
    const s = sessaoVagas();
    const { entrada: e, sessao } = alocada(entrada("ana", { dataEntradaOriginal: original }), s);
    expect(sessao.ocupadas).toBe(1);

    const r = recusar(e, sessao, T);
    const depois = aplicar(r);
    expect(depois.entrada).toMatchObject({
      estado: "aguardando",
      sessaoId: null,
      alocadaEm: null,
      dataEntradaOriginal: original,
      sessoesRecusadas: ["s1"],
    });
    expect(depois.sessao.ocupadas).toBe(0);
    expect(eventos(r).map((ev) => ev.tipo)).toEqual(["recusada", "vaga_liberada"]);

    // Volta à lista, mas não é sugerida de novo para a mesma sessão; para outra, sim.
    const outra = congelar([depois.entrada, entrada("bruno", { dataEntradaOriginal: T })]);
    expect(sugerir(outra, depois.sessao, CONFIG_PADRAO, T).map((x) => x.entradaId)).toEqual(["bruno"]);
    expect(sugerir(outra, sessaoVagas({ id: "s9" }), CONFIG_PADRAO, T)[0]?.entradaId).toBe("ana");

    expect(recusar(entrada("x"), sessao, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });

  it("RN-REM-03: remanejada recusa 1ª vez continua remanejada; 2ª vez perde a preferência", () => {
    const s = sessaoVagas();
    const rem = entrada("r", { estado: "remanejada", remanejada: "privada" });
    const primeira = aplicar(recusar(alocada(rem, s).entrada, alocada(rem, s).sessao, T));
    expect(primeira.entrada).toMatchObject({ estado: "remanejada", remanejada: "privada", recusas: 1 });
    expect(primeira.sessao.ocupadas).toBe(0);

    const segunda = aplicar(recusar(alocada(primeira.entrada, s).entrada, alocada(primeira.entrada, s).sessao, T));
    expect(segunda.entrada).toMatchObject({ estado: "aguardando", remanejada: null, recusas: 2 });

    const publica = { ...primeira.entrada, remanejada: "publica" as const };
    const r = recusar(alocada(publica, s).entrada, alocada(publica, s).sessao, T);
    expect(aplicar(r).entrada.estado).toBe("cancelada");
    expect(eventos(r).find((ev) => ev.tipo === "cancelada")?.motivo).toBe("inscreva-se de novo");
  });
});

describe("abertura da sessão", () => {
  it("RN-CONF-04: alocação pendente na abertura volta à lista com a data original", () => {
    const s = sessaoVagas();
    const original = T - 40 * DIA;
    const p1 = alocada(entrada("pend", { dataEntradaOriginal: original }), s);
    const p2 = alocada(entrada("conf"), p1.sessao);
    const conf = aplicar(confirmar(p2.entrada, p2.sessao, T));
    const outraSessao = { ...alocada(entrada("fora"), sessaoVagas({ id: "s2" })).entrada };
    const todas = congelar([p1.entrada, conf, outraSessao, entrada("lista")]);

    const r = pendentesNaAbertura(todas, p2.sessao);
    const { entradas, sessao } = aplicar(r);
    const por = (id: string) => entradas.find((e) => e.id === id);
    expect(por("pend")).toMatchObject({
      estado: "aguardando",
      sessaoId: null,
      alocadaEm: null,
      dataEntradaOriginal: original,
    });
    expect(por("conf")).toEqual(conf);
    expect(por("fora")).toEqual(outraSessao);
    expect(por("lista")).toEqual(entrada("lista"));
    expect(sessao.ocupadas).toBe(1);
    expect(eventos(r)).toEqual([
      { tipo: "vaga_liberada", entradaId: "pend", sessaoId: "s1", motivo: "sessão abriu sem confirmação" },
    ]);
  });
});

describe("lista parada", () => {
  const cfg = CONFIG_PADRAO;
  const base = entrada("a", { dataEntradaOriginal: T });

  it("RN-PARADA-01: pergunta 'ainda precisa?' a cada 30 dias na lista", () => {
    expect(perguntarAindaPrecisa(base, cfg, T + 30 * DIA - 1)).toEqual({ ok: false, erro: "fora_do_prazo" });
    const r = perguntarAindaPrecisa(base, cfg, T + 30 * DIA);
    const perguntada = aplicar(r);
    expect(perguntada).toMatchObject({ estado: "aguardando", perguntadoEm: T + 30 * DIA });
    expect(eventos(r)).toEqual([{ tipo: "ainda_precisa", entradaId: "a" }]);
    // Com a pergunta sem resposta, não pergunta de novo.
    expect(perguntarAindaPrecisa(perguntada, cfg, T + 61 * DIA)).toEqual({ ok: false, erro: "fora_do_prazo" });
    // Respondeu: a próxima é 30 dias depois da resposta.
    const respondida = aplicar(responderAindaPrecisa(perguntada, T + 32 * DIA));
    expect(perguntarAindaPrecisa(respondida, cfg, T + 62 * DIA - 1).ok).toBe(false);
    expect(perguntarAindaPrecisa(respondida, cfg, T + 62 * DIA).ok).toBe(true);
    expect(perguntarAindaPrecisa(entrada("x", { estado: "alocada" }), cfg, T + 90 * DIA)).toEqual({
      ok: false,
      erro: "transicao_proibida",
    });
  });

  it("RN-PARADA: 7 dias sem resposta arquiva; reativa até 30 dias", () => {
    const perguntadoEm = T + 30 * DIA;
    const perguntada = aplicar(perguntarAindaPrecisa(base, cfg, perguntadoEm));
    expect(arquivar(perguntada, cfg, perguntadoEm + 7 * DIA - 1)).toEqual({ ok: false, erro: "fora_do_prazo" });
    // Respondida a tempo: não arquiva.
    const respondida = aplicar(responderAindaPrecisa(perguntada, perguntadoEm + DIA));
    expect(arquivar(respondida, cfg, perguntadoEm + 7 * DIA)).toEqual({ ok: false, erro: "fora_do_prazo" });

    const arquivadaEm = perguntadoEm + 7 * DIA;
    const r = arquivar(perguntada, cfg, arquivadaEm);
    const arquivada = aplicar(r);
    expect(arquivada).toMatchObject({ estado: "arquivada", arquivadaEm });
    expect(eventos(r)).toEqual([{ tipo: "arquivada", entradaId: "a" }]);

    const volta = aplicar(reativar([], arquivada, LIVRE, arquivadaEm + 30 * DIA));
    expect(volta).toMatchObject({ estado: "aguardando", dataEntradaOriginal: T, arquivadaEm: null });
    // A reativação vale como resposta: não pergunta nem arquiva logo em seguida.
    expect(arquivar(volta, cfg, arquivadaEm + 30 * DIA).ok).toBe(false);
    expect(perguntarAindaPrecisa(volta, cfg, arquivadaEm + 30 * DIA).ok).toBe(false);

    expect(reativar([], arquivada, LIVRE, arquivadaEm + 30 * DIA + 1)).toEqual({ ok: false, erro: "fora_do_prazo" });
    // Serviço virou regulado (RN-ENC-07).
    expect(reativar([], arquivada, { ...LIVRE, modo: "regulado" }, arquivadaEm + DIA)).toEqual({
      ok: false,
      erro: "servico_regulado",
    });
    // Nova entrada ativa da mesma pessoa no serviço enquanto estava arquivada (INV-01).
    expect(reativar([entrada("nova")], { ...arquivada, pessoa: entrada("nova").pessoa }, LIVRE, arquivadaEm)).toEqual({
      ok: false,
      erro: "duplicada",
    });
    expect(reativar([], base, LIVRE, T)).toEqual({ ok: false, erro: "transicao_proibida" });
  });
});

describe("I1: idade na lista de espera (AD-027)", () => {
  it("AD-027: a prioridade da entrada usa a idade de agora, não a da criação", () => {
    // Criada aos 59 anos; a sugestão de 30 dias depois já mostra 60.
    const criada = aplicar(
      criarEntrada(
        [],
        {
          servico: LIVRE,
          pessoa: pessoa("Zé", { nascimento: "1966-11-20" }),
          responsavelId: "ze",
          respostas: respostas(),
          id: "ze",
        },
        T,
      ),
    );
    expect(prioridadeDaEntrada(criada, T, CONFIG_PADRAO.fuso).grupos).toEqual([]);
    const depois = T + 30 * DIA;
    expect(prioridadeDaEntrada(criada, depois, CONFIG_PADRAO.fuso).grupos).toEqual(["idoso"]);
    const outra = entrada("ana", { dataEntradaOriginal: T - DIA });
    const sugestao = sugerir(congelar([outra, criada]), sessaoVagas({ vagas: 5 }), CONFIG_PADRAO, depois);
    expect(sugestao.map((s) => s.entradaId)).toEqual(["ze", "ana"]);
    expect(sugestao[0]?.motivos).toContain("pessoa idosa, 60 anos");
  });
});
