import { describe, expect, it } from "vitest";
import { desfechoDoQuestionario, falaDaPergunta, RESPOSTAS_VAZIAS, telasDo } from "@/lib/questionario";

const agora = Date.UTC(2026, 10, 12, 12);

describe("questionário no app (T3.3, questionário v1)", () => {
  it("a gravidade só aparece para problema novo", () => {
    expect(telasDo({ ...RESPOSTAS_VAZIAS, motivo: "exame" })).toEqual(["alarmes", "motivo", "condicoes", "grupos"]);
    expect(telasDo({ ...RESPOSTAS_VAZIAS, motivo: "novo" })).toEqual([
      "alarmes",
      "motivo",
      "gravidade",
      "condicoes",
      "grupos",
    ]);
  });

  it("RN-RISCO-02: sinal de alarme → emergência (192), sem entrar na lista; autolesão → apoio CVV/SAMU", () => {
    const r = { ...RESPOSTAS_VAZIAS, motivo: "acompanhamento" as const };
    expect(desfechoDoQuestionario({ ...r, alarmes: ["dor_no_peito"] }, "1990-01-01", agora)).toBe("emergencia");
    expect(desfechoDoQuestionario({ ...r, alarmes: ["autolesao"] }, "1990-01-01", agora)).toBe("apoio");
    expect(desfechoDoQuestionario(r, "1990-01-01", agora)).toBe("segue");
  });

  it("o Dr. Lino pergunta numa conversa; para outra pessoa, usa o primeiro nome dela", () => {
    expect(falaDaPergunta("alarmes", "eu", "")).toBe("antes de tudo: você está com algum destes agora?");
    expect(falaDaPergunta("alarmes", "outra", "Ana")).toBe("antes de tudo: Ana está com algum destes agora?");
    expect(falaDaPergunta("motivo", "eu", "")).toBe("e por que você quer o atendimento?");
    expect(falaDaPergunta("motivo", "outra", "Ana")).toBe("e por que Ana precisa do atendimento?");
    expect(falaDaPergunta("gravidade", "outra", "Ana")).toBe("entendi. e como está esse problema?");
    expect(falaDaPergunta("condicoes", "outra", "Ana")).toBe("Ana tem alguma destas condições?");
    expect(falaDaPergunta("grupos", "eu", "")).toBe("por último: alguma destas se aplica a você?");
    expect(falaDaPergunta("grupos", "outra", "Ana")).toBe("por último: alguma destas se aplica a Ana?");
  });

  it("sem o nome ainda (refazer de outra pessoa), fala 'a pessoa'", () => {
    expect(falaDaPergunta("condicoes", "outra", "")).toBe("a pessoa tem alguma destas condições?");
  });
});
