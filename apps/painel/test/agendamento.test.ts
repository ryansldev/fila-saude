import { describe, expect, it } from "vitest";
import {
  alocarAte,
  barrasDeVagas,
  linhaDeMotivos,
  quandoNoFuso,
  resumoDasPendencias,
  rotuloDoRisco,
  seloDoRisco,
  situacaoDoAlocado,
  textoDasVagas,
} from "@/lib/agendamento";
import { ICONES_DO_MENU, ITENS_DO_MENU, menuDoPainel } from "@/lib/navegacao";

const FUSO = "America/Sao_Paulo";

describe("agendamento no painel (fatia 4)", () => {
  it("menu: quem agenda vê 'Agendamento' (e não mais 'Em breve')", () => {
    expect(menuDoPainel([{ perfil: "agendar", unidadeId: "u1" }]).map((i) => i.rotulo)).toEqual(["Agendamento"]);
  });

  it("data e hora no fuso da unidade, com o dia da semana", () => {
    // 2026-11-18 11:00Z = 08:00 em São Paulo (quarta-feira).
    expect(quandoNoFuso("2026-11-18T11:00:00.000Z", FUSO)).toBe("qua., 18/11 às 08:00");
  });

  it("vagas: ocupadas de quantas; sem limite diz 'sem limite'", () => {
    expect(textoDasVagas(2, 5)).toBe("2 de 5 vagas");
    expect(textoDasVagas(3, null)).toBe("3 alocados · sem limite");
  });

  it("RN-CONF-03: situação do alocado; sem resposta depois do prazo fica destacada", () => {
    expect(situacaoDoAlocado({ estado: "alocada", destacada: false })).toEqual({
      rotulo: "Aguardando resposta",
      tom: "neutro",
    });
    expect(situacaoDoAlocado({ estado: "alocada", destacada: true })).toEqual({
      rotulo: "Sem resposta: ligar",
      tom: "alerta",
    });
    expect(situacaoDoAlocado({ estado: "confirmada", destacada: false })).toEqual({ rotulo: "Confirmou", tom: "ok" });
    expect(situacaoDoAlocado({ estado: "na_fila", destacada: false }).rotulo).toBe("Na fila");
  });

  it("RN-RISCO-01: o risco diz se é sugerido pelo app ou confirmado pela triagem", () => {
    expect(rotuloDoRisco({ nivel: "urgente", confirmado: false })).toBe("Urgente · sugerido pelo app");
    expect(rotuloDoRisco({ nivel: "atencao", confirmado: true })).toBe("Atenção · confirmado");
  });

  it("todo item do menu tem ícone (Agendamento tinha um círculo vazio)", () => {
    for (const item of ITENS_DO_MENU) expect(ICONES_DO_MENU[item.href], item.rotulo).toBeDefined();
  });

  it("barrinhas de vagas: confirmadas, pendentes, livres; sem limite não desenha", () => {
    expect(barrasDeVagas({ vagas: 4, confirmadas: 1, pendentes: 1 })).toEqual([
      "confirmada",
      "pendente",
      "livre",
      "livre",
    ]);
    expect(barrasDeVagas({ vagas: null, confirmadas: 2, pendentes: 0 })).toBeNull();
  });

  it("selo do risco: '(app)' quando sugerido; confirmado sem o '(app)'", () => {
    expect(seloDoRisco({ nivel: "urgente", confirmado: false })).toEqual({ rotulo: "Urgente (app)", tom: "alerta" });
    expect(seloDoRisco({ nivel: "rotina", confirmado: true })).toEqual({ rotulo: "Rotina", tom: "neutro" });
    expect(seloDoRisco({ nivel: "emergencia", confirmado: true })?.tom).toBe("perigo");
  });

  it("pendências: nada para ligar some; senão, quantas e quem espera há mais tempo", () => {
    expect(resumoDasPendencias([], 0)).toBeNull();
    const agora = Date.parse("2026-11-16T12:00:00.000Z");
    const item = (nome: string, horas: number) => ({
      entradaId: "00000000-0000-4000-8000-000000000001",
      nome,
      telefone: null,
      servico: "Odontologia",
      sessao: { id: "00000000-0000-4000-8000-000000000002", inicio: "2026-11-19T16:00:00.000Z" },
      alocadaEm: new Date(agora - horas * 3600_000).toISOString(),
      prazo: new Date(agora - horas * 3600_000 + 24 * 3600_000).toISOString(),
      destacada: horas >= 24,
      ultimaTentativa: null,
    });
    expect(resumoDasPendencias([item("Ana Souza", 2), item("Bruno Lima", 30)], agora)).toEqual({
      total: 2,
      texto: "2 pessoas para ligar · Bruno Lima sem resposta há 30 h",
    });
    expect(resumoDasPendencias([item("Ana Souza", 2)], agora)?.texto).toBe(
      "1 pessoa para ligar · Ana Souza sem resposta há 2 h",
    );
  });

  it("alocação vai até a véspera, no fuso da unidade", () => {
    expect(alocarAte("2026-11-17T16:00:00.000Z", FUSO)).toBe("seg., 16/11");
  });

  it("rotina sugerida não leva selo (só o risco que muda a ordem chama atenção)", () => {
    expect(seloDoRisco({ nivel: "rotina", confirmado: false })).toBeNull();
    expect(seloDoRisco({ nivel: "atencao", confirmado: false })?.rotulo).toBe("Atenção (app)");
  });

  it("a linha de motivos não repete 'sem sinais de risco' de quem é rotina", () => {
    const motivos = ["pessoa idosa, 68 anos", "espera há 3 dias"];
    expect(linhaDeMotivos({ nivel: "rotina", regra: "Sem sinais de risco" }, motivos)).toBe(
      "pessoa idosa, 68 anos · espera há 3 dias",
    );
    expect(linhaDeMotivos({ nivel: "urgente", regra: "Problema novo forte" }, ["espera há 3 dias"])).toBe(
      "Problema novo forte · espera há 3 dias",
    );
  });
});
