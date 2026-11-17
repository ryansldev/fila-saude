import { answersSchema } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, QUESTIONS, questionnaireOutcome, questionSpeech, screensOf } from "@/lib/questionnaire";

const now = Date.UTC(2026, 10, 12, 12);

describe("questionário no app (T3.3, questionário v1)", () => {
  it("a gravidade só aparece para problema novo", () => {
    expect(screensOf({ ...EMPTY_ANSWERS, reason: "exam" })).toEqual(["alarms", "reason", "conditions", "groups"]);
    expect(screensOf({ ...EMPTY_ANSWERS, reason: "new" })).toEqual([
      "alarms",
      "reason",
      "severity",
      "conditions",
      "groups",
    ]);
  });

  it("RN-RISCO-02: sinal de alarme → emergência (192), sem entrar na lista; autolesão → apoio CVV/SAMU", () => {
    const r = { ...EMPTY_ANSWERS, reason: "follow_up" as const };
    expect(questionnaireOutcome({ ...r, alarms: ["chest_pain"] }, "1990-01-01", now)).toBe("emergency");
    expect(questionnaireOutcome({ ...r, alarms: ["self_harm"] }, "1990-01-01", now)).toBe("support");
    expect(questionnaireOutcome(r, "1990-01-01", now)).toBe("continues");
  });

  it("o Dr. Lino pergunta numa conversa; para outra pessoa, usa o primeiro nome dela", () => {
    expect(questionSpeech("alarms", "me", "")).toBe("antes de tudo: você está com algum destes agora?");
    expect(questionSpeech("alarms", "other", "Ana")).toBe("antes de tudo: Ana está com algum destes agora?");
    expect(questionSpeech("reason", "me", "")).toBe("e por que você quer o atendimento?");
    expect(questionSpeech("reason", "other", "Ana")).toBe("e por que Ana precisa do atendimento?");
    expect(questionSpeech("severity", "other", "Ana")).toBe("entendi. e como está esse problema?");
    expect(questionSpeech("conditions", "other", "Ana")).toBe("Ana tem alguma destas condições?");
    expect(questionSpeech("groups", "me", "")).toBe("por último: alguma destas se aplica a você?");
    expect(questionSpeech("groups", "other", "Ana")).toBe("por último: alguma destas se aplica a Ana?");
  });

  it("sem o nome ainda (refazer de outra pessoa), fala 'a pessoa'", () => {
    expect(questionSpeech("conditions", "other", "")).toBe("a pessoa tem alguma destas condições?");
  });
});

describe("opções do questionário", () => {
  const ids = (screen: keyof typeof QUESTIONS) => QUESTIONS[screen].options.map(([id]) => id);
  it("cada opção é um valor que a API aceita", () => {
    const shape = answersSchema.shape;
    expect(ids("reason").filter((id) => !shape.reason.safeParse(id).success)).toEqual([]);
    expect(ids("severity").filter((id) => !shape.severity.safeParse(id).success)).toEqual([]);
    expect(ids("alarms").filter((id) => !shape.alarms.safeParse([id]).success)).toEqual([]);
    expect(ids("conditions").filter((id) => !shape.conditions.safeParse([id]).success)).toEqual([]);
    expect(ids("groups").filter((id) => !shape.groups.safeParse([id]).success)).toEqual([]);
  });
});
