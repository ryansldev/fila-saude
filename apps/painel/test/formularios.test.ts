import { usuarioPainelEntradaSchema } from "@fila-saude/schemas/usuario";
import { describe, expect, it } from "vitest";
import { ErroDaApi } from "@/lib/api";
import { errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { servicosParaEtapa } from "@/lib/formularios/estacao";
import { mostraTempoTriagem, servicoParaEnvio } from "@/lib/formularios/servico";
import {
  ajustarVisibilidade,
  diaValido,
  estacoesDoServico,
  horarioParaEnvio,
  horarioParaTela,
  lerVagas,
  visibilidadesPermitidas,
} from "@/lib/formularios/sessao";
import { campoHerdado, configParaEnvio } from "@/lib/formularios/unidade";
import { funcoesQuePodeConceder, problemasDoCadastro, unidadesQuePodeAtribuir } from "@/lib/formularios/usuario";
import { menuDoPainel } from "@/lib/navegacao";

describe("erros da API nos formulários", () => {
  it("erro 400 da API aparece no campo certo", () => {
    const e = new ErroDaApi(400, "entrada_invalida", undefined, { nome: ["obrigatório"], "config.janelaK": ["K ≥ 1"] });
    expect(errosDoEnvio(e)).toMatchObject({ geral: null, campos: { nome: "obrigatório", "config.janelaK": "K ≥ 1" } });
  });
  it("409 ultimo_gestor e login_em_uso mostram a mensagem", () => {
    expect(mensagemDoErro(new ErroDaApi(409, "ultimo_gestor"))).toMatch(/último gestor/i);
    expect(mensagemDoErro(new ErroDaApi(409, "login_em_uso"))).toMatch(/login já está em uso/i);
  });
  it("409 servico_com_entradas mostra quantas entradas", () => {
    const e = new ErroDaApi(409, "servico_com_entradas", undefined, undefined, { entradasAtivas: 3 });
    expect(mensagemDoErro(e)).toMatch(/3 entradas ativas/);
  });
  it("409 sessao_aberta, estacao_ocupada, versao_desatualizada e sessao_com_pacientes", () => {
    expect(mensagemDoErro(new ErroDaApi(409, "sessao_aberta"))).toMatch(/há sessão aberta/i);
    expect(mensagemDoErro(new ErroDaApi(409, "estacao_ocupada"))).toMatch(/estação está aberta/i);
    expect(mensagemDoErro(new ErroDaApi(409, "versao_desatualizada"))).toMatch(/recarregue/i);
    expect(mensagemDoErro(new ErroDaApi(409, "sessao_com_pacientes"))).toMatch(/pacientes/i);
  });
  it("erro desconhecido vira mensagem genérica", () => {
    expect(mensagemDoErro(new Error("x"))).toMatch(/tente de novo/i);
  });
});

describe("unidade", () => {
  const efetiva = {
    valores: { janelaK: 3, toleranciaMin: 7 },
    origem: { janelaK: "padrao", toleranciaMin: "unidade" },
  } as const;
  it("campo vazio mostra o valor herdado e a origem", () => {
    expect(campoHerdado(efetiva, "janelaK")).toEqual({
      valor: 3,
      origem: "padrao",
      proprio: false,
      texto: "herdado do padrão: 3",
    });
    expect(campoHerdado(efetiva, "toleranciaMin").proprio).toBe(true);
  });
  it("limpar um valor próprio envia null e volta a herdar", () => {
    expect(configParaEnvio({ janelaK: "", toleranciaMin: "" }, ["toleranciaMin"])).toEqual({ toleranciaMin: null });
    expect(configParaEnvio({ janelaK: "4" }, [])).toEqual({ janelaK: 4 });
  });
});

describe("equipe", () => {
  const sms = { vinculos: [], funcoes: [{ funcao: "gestao_sms" as const, unidadeId: null }] };
  const gerente = { vinculos: [], funcoes: [{ funcao: "gerente_ubs" as const, unidadeId: "u1" }] };
  const unidades = [
    { id: "u1", nome: "UBS 1" },
    { id: "u2", nome: "UBS 2" },
  ];

  it("RN-PERF-04: o formulário só oferece o que quem está logado pode conceder", () => {
    expect(funcoesQuePodeConceder(sms)).toEqual(["gestao_sms", "regulacao_sms", "gerente_ubs", "agendar"]);
    expect(funcoesQuePodeConceder(gerente)).toEqual(["agendar"]);
    expect(unidadesQuePodeAtribuir(sms, unidades).map((u) => u.id)).toEqual(["u1", "u2"]);
    expect(unidadesQuePodeAtribuir(gerente, unidades).map((u) => u.id)).toEqual(["u1"]);
  });

  it("ocupação exige a unidade; função de gerente exige a unidade; nada marcado pede ao menos uma", () => {
    expect(problemasDoCadastro(sms, { vinculos: [], funcoes: [] })).toEqual({
      _: "Informe ao menos uma ocupação ou função.",
    });
    expect(problemasDoCadastro(sms, { vinculos: [], funcoes: [{ funcao: "gerente_ubs", unidadeId: null }] })).toEqual({
      "funcoes.0.unidadeId": "Escolha a unidade.",
    });
    expect(problemasDoCadastro(sms, { vinculos: [{ unidadeId: "u1", ocupacao: "enfermeiro" }], funcoes: [] })).toEqual(
      {},
    );
  });

  it("gerente que tenta cadastrar em outra UBS recebe o aviso antes de enviar", () => {
    expect(problemasDoCadastro(gerente, { vinculos: [{ unidadeId: "u2", ocupacao: "medico" }], funcoes: [] })).toEqual({
      _: "Você só cadastra a equipe da sua unidade, sem função de gestão.",
    });
  });
});

describe("serviço e estação", () => {
  it("tempo de triagem some sem triagem", () => {
    expect(mostraTempoTriagem(false)).toBe(false);
    expect(
      servicoParaEnvio({
        nome: "X",
        prefixo: "x",
        exigeTriagem: false,
        modo: "livre",
        triagem: "5",
        atendimento: "15",
      }),
    ).toEqual({ nome: "X", prefixo: "X", exigeTriagem: false, modo: "livre", tempoMedioMin: { atendimento: 15 } });
  });
  it("etapa triagem filtra os serviços", () => {
    const servicos = [
      { id: "a", nome: "A", exigeTriagem: true },
      { id: "b", nome: "B", exigeTriagem: false },
    ];
    expect(servicosParaEtapa(servicos, "triagem").map((s) => s.id)).toEqual(["a"]);
    expect(servicosParaEtapa(servicos, "atendimento")).toHaveLength(2);
  });
});

describe("sessão", () => {
  it("08:00 de 12/11/2026 em America/Sao_Paulo vai como 2026-11-12T11:00:00Z e volta como 08:00", () => {
    const iso = horarioParaEnvio("2026-11-12", "08:00", "America/Sao_Paulo");
    expect(iso).toBe("2026-11-12T11:00:00.000Z");
    expect(horarioParaTela(iso, "America/Sao_Paulo")).toEqual({ data: "2026-11-12", hora: "08:00" });
  });
  it("privada esconde e desliga a dispensa", () => {
    expect(ajustarVisibilidade({ visibilidade: "publica", dispensaPreCadastro: true }, "privada")).toEqual({
      visibilidade: "privada",
      dispensaPreCadastro: false,
    });
  });
  it("serviço regulado não oferece pública", () => {
    expect(visibilidadesPermitidas("regulado")).toEqual(["privada"]);
    expect(visibilidadesPermitidas("livre")).toEqual(["publica", "privada"]);
  });
  it("só estações que atendem o serviço", () => {
    const estacoes = [
      { id: "e1", nome: "C1", servicos: ["s1"] },
      { id: "e2", nome: "C2", servicos: ["s2"] },
    ];
    expect(estacoesDoServico(estacoes, "s1").map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("menu", () => {
  it("menu sem Regras do município; TVs entram na fatia 2", () => {
    const rotulos = menuDoPainel([
      { perfil: "gestao_sms", unidadeId: null },
      { perfil: "gerente_ubs", unidadeId: "u1" },
    ]).map((i) => i.rotulo);
    expect(rotulos).not.toContain("Regras do município");
    expect(rotulos).toEqual([
      "Unidades",
      "Equipe",
      "Serviços",
      "Estações",
      "Sessões",
      "TVs",
      "Fila do dia",
      "QR de entrada",
    ]);
  });
});

describe("erros que sumiam (revisão 2026-11-13)", () => {
  it("chave mais funda chega ao campo que a tela mostra; erro na raiz vira mensagem geral", () => {
    const e = new ErroDaApi(400, "entrada_invalida", undefined, {
      "horario.1.0.abre": ["hora inválida"],
      _: ["intervalos sobrepostos"],
    });
    const r = errosDoEnvio(e);
    expect(r.campos["horario.1.0"]).toBe("hora inválida");
    expect(r.geral).toBe("intervalos sobrepostos");
  });

  it("códigos de conflito com mensagem própria", () => {
    expect(mensagemDoErro(new ErroDaApi(409, "estacao_com_chamado"))).toMatch(/paciente chamado/);
    expect(mensagemDoErro(new ErroDaApi(400, "motivo_obrigatorio"))).toMatch(/motivo/);
    expect(mensagemDoErro(new ErroDaApi(409, "estacao_em_uso"))).toMatch(/sessão/);
    expect(mensagemDoErro(new ErroDaApi(409, "sessao_fechada"))).toMatch(/sessão/);
  });
});

describe("sessões: vagas e dia (revisão 2026-11-13)", () => {
  it("vagas: vazio = sem limite; número inteiro ≥ 1; qualquer outra coisa é erro (antes virava 'sem limite')", () => {
    expect(lerVagas("")).toEqual({ ok: true, vagas: null });
    expect(lerVagas(" 12 ")).toEqual({ ok: true, vagas: 12 });
    expect(lerVagas("1,5").ok).toBe(false);
    expect(lerVagas("dez").ok).toBe(false);
    expect(lerVagas("0").ok).toBe(false);
  });

  it("dia com ano de 5 dígitos não derruba a página", () => {
    expect(diaValido("2026-11-13")).toBe(true);
    expect(diaValido("20261-11-13")).toBe(false);
    expect(diaValido("")).toBe(false);
  });
});

describe("validação no painel antes de enviar (revisão 2026-11-13)", () => {
  it("usa o mesmo schema da API e devolve o erro por campo, em português", () => {
    const r = validarNoCliente(usuarioPainelEntradaSchema, {
      login: "maria silva",
      nome: "",
      senha: "curta",
      vinculos: [],
      funcoes: [],
    });
    expect(r?.campos.login).toMatch(/letras sem acento/);
    expect(r?.campos.senha).toBeDefined();
    expect(r?.campos.nome).toBeDefined();
    expect(
      validarNoCliente(usuarioPainelEntradaSchema, {
        login: "maria",
        nome: "Maria",
        senha: "segredo12",
        vinculos: [],
        funcoes: [],
      }),
    ).toBeNull();
  });
});
