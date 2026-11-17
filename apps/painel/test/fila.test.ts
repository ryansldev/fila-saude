import { describe, expect, it } from "vitest";
import {
  acoesDaFila,
  agruparFila,
  botoesDePresenca,
  buscarNaFila,
  contadoresDaFila,
  contextoDaLinha,
  cronometro,
  estacoesQueOpera,
  filaVazia,
  filtroValido,
  minutosDesde,
  ordenarFila,
  pilulaDaSessao,
  rotuloDoEstado,
  textoDasPendencias,
  textoDoDocumento,
  textoDoResponsavel,
} from "@/lib/fila";

const item = (senha: string, estado: string) => ({ senha, estado });

describe("fila do dia no painel (T3.4, T3.7)", () => {
  it("botões pela matriz e pela unidade do perfil (PD-38)", () => {
    const gerente = [{ perfil: "gerente_ubs" as const, unidadeId: "u1" }];
    const recepcao = [{ perfil: "recepcao" as const, unidadeId: "u1" }];
    expect(acoesDaFila(gerente, "u1", "planejada")).toEqual({ abrir: true, encerrar: false, presenca: false });
    expect(acoesDaFila(gerente, "u1", "aberta")).toEqual({ abrir: false, encerrar: true, presenca: false });
    expect(acoesDaFila(gerente, "u2", "planejada").abrir).toBe(false);
    expect(acoesDaFila(recepcao, "u1", "aberta")).toEqual({ abrir: false, encerrar: false, presenca: true });
    expect(acoesDaFila(recepcao, "u1", "planejada").presenca).toBe(false);
  });

  it("ordem da tela: chamado, na unidade, remotos, depois os que saíram; pela senha", () => {
    const ordem = ordenarFila([
      item("C-004", "atendido_na_etapa"),
      item("C-003", "remoto"),
      item("C-002", "presente"),
      item("C-001", "remoto"),
      item("C-005", "chamado"),
    ]).map((i) => i.senha);
    expect(ordem).toEqual(["C-005", "C-002", "C-001", "C-003", "C-004"]);
  });

  it("textos dos estados e o cronômetro da chamada (AD-006)", () => {
    expect(rotuloDoEstado("remoto")).toBe("A caminho");
    expect(rotuloDoEstado("presente")).toBe("Na unidade");
    expect(rotuloDoEstado("saiu_da_fila")).toBe("Saiu da fila");
    const em = "2026-11-12T12:00:00.000Z";
    expect(cronometro(em, Date.parse(em) + 65_000)).toBe("01:05");
    expect(cronometro(em, Date.parse(em) - 1000)).toBe("00:00");
  });

  it("RN-FILA-05: pendências do QR recusado em texto para a recepção; sem pendência, nada", () => {
    expect(textoDasPendencias(["conta"])).toBe("Passe na recepção: conferir a conta");
    expect(textoDasPendencias(["pessoa_atendida", "prioridade"])).toBe(
      "Passe na recepção: conferir a pessoa atendida, a prioridade",
    );
    expect(textoDasPendencias([])).toBeNull();
  });
});

describe("presença pela recepção (RN-PRES-03, RN-FILA-05), revisão 2026-11-13", () => {
  it("qualquer remoto pode ter a presença marcada; com pendência, conferindo os documentos; 'não confere' sempre com motivo", () => {
    expect(botoesDePresenca({ estado: "remoto", pendencias: [] }, true)).toEqual({
      marcar: "Marcar presença",
      naoConfere: false,
    });
    expect(botoesDePresenca({ estado: "remoto", pendencias: ["conta"] }, true)).toEqual({
      marcar: "Conferir documentos e marcar presença",
      naoConfere: true,
    });
    expect(botoesDePresenca({ estado: "presente", pendencias: [] }, true)).toBeNull();
    expect(botoesDePresenca({ estado: "remoto", pendencias: [] }, false)).toBeNull();
  });

  it("CPF mascarado e nascimento em dd/mm/aaaa para comparar com o documento", () => {
    expect(textoDoDocumento({ nascimento: "1990-05-05", cpf: "•••.982.247-••" })).toBe(
      "nasc. 05/05/1990 · CPF •••.982.247-••",
    );
    expect(textoDoDocumento({ nascimento: "1990-05-05", cpf: null })).toBe("nasc. 05/05/1990 · sem CPF");
  });
});

describe("estação: só as que o perfil opera (PD-46), revisão 2026-11-13", () => {
  const ests = [
    { id: "t1", nome: "Triagem", etapa: "triagem" as const },
    { id: "a1", nome: "Sala 1", etapa: "atendimento" as const },
  ];
  it("técnico só triagem; enfermeiro as duas; perfil de outra unidade, nenhuma", () => {
    expect(estacoesQueOpera(ests, [{ perfil: "tecnico_enfermagem", unidadeId: "u1" }], "u1").map((e) => e.id)).toEqual([
      "t1",
    ]);
    expect(estacoesQueOpera(ests, [{ perfil: "enfermeiro", unidadeId: "u1" }], "u1").map((e) => e.id)).toEqual([
      "t1",
      "a1",
    ]);
    expect(estacoesQueOpera(ests, [{ perfil: "enfermeiro", unidadeId: "u2" }], "u1")).toEqual([]);
  });
});

describe("fila do dia por situação (redesenho 2026-11-13)", () => {
  const it_ = (senha: string, estado: string, pendencias: string[] = []) => ({ senha, estado, pendencias });
  const itens = [
    it_("C-005", "remoto"),
    it_("C-002", "presente"),
    it_("C-004", "remoto", ["conta"]),
    it_("C-001", "chamado"),
    it_("C-003", "atendido_na_etapa"),
    it_("C-006", "saiu_da_fila"),
    it_("C-007", "presente"),
  ];

  it("separa quem precisa da recepção, os chamados, quem está na unidade, a caminho e quem já saiu", () => {
    const g = agruparFila(itens);
    expect(g.recepcao.map((i) => i.senha)).toEqual(["C-004"]);
    expect(g.chamados.map((i) => i.senha)).toEqual(["C-001"]);
    expect(g.naUnidade.map((i) => i.senha)).toEqual(["C-002", "C-007"]);
    expect(g.aCaminho.map((i) => i.senha)).toEqual(["C-005"]);
    expect(g.encerrados.map((i) => i.senha)).toEqual(["C-003", "C-006"]);
  });

  it("contadores do topo: na unidade, a caminho (inclui quem espera a recepção), chamados e atendidos", () => {
    expect(contadoresDaFila(itens)).toEqual({ naUnidade: 2, aCaminho: 2, chamados: 1, atendidos: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
// Fila do dia, caminho C: a unidade inteira, com busca.

const AGORA = Date.parse("2026-11-16T12:00:00.000Z");
const pessoa = (nome: string, senha: string, cpf: string | null, servico = "Clínico geral") => ({
  nome,
  senha,
  servico,
  documento: { nascimento: "1990-01-01", cpf },
});

describe("busca da Fila do dia", () => {
  const itens = [
    pessoa("Ana Souza", "C-001", "•••.982.247-••"),
    pessoa("Carla Dias", "C-002", null),
    pessoa("Ana Souza", "V-002", "•••.982.247-••", "Curativos"),
    pessoa("Bruno Lima", "C-003", "•••.444.777-••"),
  ];

  it("vazia devolve todos", () => {
    expect(buscarNaFila(itens, "  ")).toHaveLength(4);
  });

  it("nome sem acento e sem maiúscula; o mesmo nome em dois serviços aparece duas vezes", () => {
    expect(buscarNaFila(itens, "âna sou").map((i) => i.servico)).toEqual(["Clínico geral", "Curativos"]);
  });

  it("senha com ou sem hífen, maiúscula ou minúscula", () => {
    expect(buscarNaFila(itens, "c002").map((i) => i.nome)).toEqual(["Carla Dias"]);
    expect(buscarNaFila(itens, "C-002").map((i) => i.nome)).toEqual(["Carla Dias"]);
  });

  it("CPF inteiro do documento casa pelos 6 dígitos do meio do CPF mascarado", () => {
    expect(buscarNaFila(itens, "111.444.777-35").map((i) => i.nome)).toEqual(["Bruno Lima"]);
    expect(buscarNaFila(itens, "52998224725")).toHaveLength(2);
  });
});

describe("linha da Fila do dia", () => {
  const base = {
    estado: "remoto",
    etapa: "triagem",
    pendencias: [] as string[],
    desde: null as string | null,
    estacao: null as string | null,
  };
  const ha = (min: number) => new Date(AGORA - min * 60_000).toISOString();

  it("minutos desde, para baixo e nunca negativo", () => {
    expect(minutosDesde(ha(12.7), AGORA)).toBe(12);
    expect(minutosDesde(new Date(AGORA + 60_000).toISOString(), AGORA)).toBe(0);
  });

  it("chamado: a sala e há quanto tempo; na unidade: a etapa e há quanto tempo", () => {
    expect(contextoDaLinha({ ...base, estado: "chamado", estacao: "Triagem 1", desde: ha(2) }, AGORA)).toEqual({
      texto: "chamado para Triagem 1",
      tempo: "há 2 min",
      tom: "chamado",
    });
    expect(contextoDaLinha({ ...base, estado: "presente", desde: ha(12) }, AGORA)).toEqual({
      texto: "esperando a triagem",
      tempo: "há 12 min",
      tom: "neutro",
    });
    expect(contextoDaLinha({ ...base, estado: "presente", etapa: "atendimento", desde: ha(1) }, AGORA).texto).toBe(
      "esperando o atendimento",
    );
  });

  it("em casa; com pendência, o que a recepção confere; dia antigo sem hora não mostra tempo", () => {
    expect(contextoDaLinha(base, AGORA)).toEqual({ texto: "em casa", tempo: null, tom: "neutro" });
    expect(contextoDaLinha({ ...base, pendencias: ["conta"] }, AGORA)).toEqual({
      texto: "conferir a conta",
      tempo: null,
      tom: "alerta",
    });
    expect(contextoDaLinha({ ...base, estado: "presente", desde: null }, AGORA).tempo).toBeNull();
  });
});

describe("pílulas de serviço da Fila do dia", () => {
  const sessao = (estado: string, naFila: number) => ({
    id: "s1",
    servico: "Clínico geral",
    estado,
    inicio: "2026-11-16T16:00:00.000Z",
    contagens: { naFila },
  });

  it("aberta mostra quantos estão na fila; planejada, quando abre; encerrada e cancelada", () => {
    expect(pilulaDaSessao(sessao("aberta", 4), "America/Sao_Paulo")).toEqual({
      rotulo: "Clínico geral",
      detalhe: "4",
      desativada: false,
    });
    expect(pilulaDaSessao(sessao("planejada", 0), "America/Sao_Paulo").detalhe).toBe("abre às 13:00");
    expect(pilulaDaSessao(sessao("encerrada", 0), "America/Sao_Paulo").detalhe).toBe("encerrada");
    expect(pilulaDaSessao(sessao("cancelada", 0), "America/Sao_Paulo").desativada).toBe(true);
  });

  it("filtro guardado que não existe mais volta para 'todas'", () => {
    expect(filtroValido("x", [{ id: "a" }])).toBe("todas");
    expect(filtroValido(null, [{ id: "a" }])).toBe("todas");
    expect(filtroValido("a", [{ id: "a" }])).toBe("a");
  });
});

describe("Fila do dia: tempo curto e fila vazia", () => {
  it("menos de 1 minuto é 'agora', não 'há 0 min'", () => {
    const i = { estado: "presente", etapa: "triagem", pendencias: [], estacao: null };
    expect(contextoDaLinha({ ...i, desde: new Date(AGORA - 20_000).toISOString() }, AGORA).tempo).toBe("agora");
  });

  it("antes de abrir, diz quando abre e quantos já se inscreveram; para o gerente, como abrir", () => {
    const s = (estado: string, ocupadas: number, inicio = "2026-11-16T12:00:00.000Z") => ({ estado, ocupadas, inicio });
    expect(
      filaVazia([s("planejada", 2), s("planejada", 3, "2026-11-16T13:00:00.000Z")], "America/Sao_Paulo", false),
    ).toBe("A fila abre às 09:00. Inscritos até agora: 5.");
    expect(filaVazia([s("planejada", 2)], "America/Sao_Paulo", true)).toBe(
      "A fila abre às 09:00. Inscritos até agora: 2. Escolha o serviço acima para abrir a sessão.",
    );
    expect(filaVazia([s("aberta", 0)], "America/Sao_Paulo", true)).toBe(
      "Ninguém na fila ainda. Quem se inscrever pelo app aparece aqui.",
    );
  });
});

describe("quem inscreveu outra pessoa (2026-11-16)", () => {
  it("o primeiro nome e a relação, sem gênero", () => {
    expect(textoDoResponsavel({ nome: "Bruno", relacao: "responsavel_legal" })).toEqual({
      texto: "por Bruno (responsável legal)",
      rotulo: "inscrição feita por Bruno, responsável legal",
    });
    expect(textoDoResponsavel({ nome: "Bruno", relacao: "cuidador" })?.texto).toBe("por Bruno (cuida no dia a dia)");
    expect(textoDoResponsavel({ nome: "Bruno", relacao: "familiar_autorizado" })?.texto).toBe(
      "por Bruno (família ou amigo)",
    );
  });

  it("inscrita por outra conta antes de existir a relação: só quem inscreveu", () => {
    expect(textoDoResponsavel({ nome: "Bruno", relacao: null })).toEqual({
      texto: "por Bruno",
      rotulo: "inscrição feita por Bruno",
    });
  });

  it("inscrita pela própria pessoa: nada", () => {
    expect(textoDoResponsavel(null)).toBeNull();
  });
});
