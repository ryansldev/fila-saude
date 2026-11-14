import { describe, expect, it } from "vitest";
import { desfechoDoQuestionario, perguntaDe, RESPOSTAS_VAZIAS, telasDo } from "@/lib/questionario";

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

  it("para outra pessoa, as perguntas ficam na terceira pessoa", () => {
    expect(perguntaDe("alarmes", "eu")).toBe("você está com algum destes agora?");
    expect(perguntaDe("alarmes", "outra")).toBe("a pessoa está com algum destes agora?");
    expect(perguntaDe("motivo", "outra")).toBe("por que ela precisa do atendimento?");
    expect(perguntaDe("gravidade", "outra")).toBe("como está esse problema?");
    expect(perguntaDe("condicoes", "outra")).toBe("ela tem alguma destas condições?");
    expect(perguntaDe("grupos", "outra")).toBe("alguma destas se aplica a quem vai ser atendido?");
  });
});
