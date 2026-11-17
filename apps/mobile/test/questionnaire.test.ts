import { answersSchema } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import {
  EMPTY_ANSWERS,
  markMultiple,
  QUESTIONS,
  questionnaireOutcome,
  questionSpeech,
  screensOf,
} from "@/lib/questionnaire";

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
    expect(questionnaireOutcome({ ...r, alarms: ["chest_pain"] })).toBe("emergency");
    expect(questionnaireOutcome({ ...r, alarms: ["self_harm"] })).toBe("support");
    expect(questionnaireOutcome(r)).toBe("continues");
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

describe("marcar numa pergunta de várias respostas", () => {
  it('"nenhum" marca a pergunta como respondida sem entrar nas respostas', () => {
    expect(markMultiple([], false, "nenhum")).toEqual({ answers: [], none: true });
  });
  it('"nenhum" depois de opções limpa as opções; uma opção depois de "nenhum" o desmarca', () => {
    expect(markMultiple(["diabetes"], false, "nenhum")).toEqual({ answers: [], none: true });
    expect(markMultiple([], true, "diabetes")).toEqual({ answers: ["diabetes"], none: false });
  });
  it("sem nenhum sinal de alarme a pessoa segue (não vira emergência)", () => {
    const { answers } = markMultiple([], false, "nenhum");
    const r = { ...EMPTY_ANSWERS, alarms: answers as never[], reason: "exam" as const };
    expect(questionnaireOutcome(r)).toBe("continues");
  });
});
