import { describe, expect, it } from "vitest";
import { ErroDaApi } from "@/lib/api";
import { errosDoEnvio, mensagemDoErro } from "@/lib/formularios/erros";
import { servicosParaEtapa } from "@/lib/formularios/estacao";
import { mostraTempoTriagem, servicoParaEnvio } from "@/lib/formularios/servico";
import {
  ajustarVisibilidade,
  estacoesDoServico,
  horarioParaEnvio,
  horarioParaTela,
  visibilidadesPermitidas,
} from "@/lib/formularios/sessao";
import { campoHerdado, configParaEnvio } from "@/lib/formularios/unidade";
import { problemasDosPerfis } from "@/lib/formularios/usuario";
import { menuDoPainel } from "@/lib/navegacao";

describe("erros da API nos formulários", () => {
  it("erro 400 da API aparece no campo certo", () => {
    const e = new ErroDaApi(400, "entrada_invalida", undefined, { nome: ["obrigatório"], "config.janelaK": ["K ≥ 1"] });
    expect(errosDoEnvio(e)).toEqual({ geral: null, campos: { nome: "obrigatório", "config.janelaK": "K ≥ 1" } });
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

describe("usuário", () => {
  it("perfil de unidade exige escolher a unidade; gestor não leva unidade", () => {
    expect(problemasDosPerfis([{ perfil: "recepcao", unidadeId: null }])).toEqual({
      "perfis.0.unidadeId": "Escolha a unidade.",
    });
    expect(problemasDosPerfis([{ perfil: "gestor", unidadeId: null }])).toEqual({});
    expect(problemasDosPerfis([])).toEqual({ perfis: "Escolha ao menos um perfil." });
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
  it("menu sem Regras do município e TVs", () => {
    const rotulos = menuDoPainel([
      { perfil: "gestor", unidadeId: null },
      { perfil: "admin", unidadeId: "u1" },
    ]).map((i) => i.rotulo);
    expect(rotulos).not.toContain("Regras do município");
    expect(rotulos).not.toContain("TVs");
    expect(rotulos).toEqual(["Unidades", "Usuários", "Serviços", "Estações", "Sessões"]);
  });
});
