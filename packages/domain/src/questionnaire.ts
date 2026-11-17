import type { Answers, Classification } from "./kinds.ts";

/**
 * RN-RISCO-02 / RN-RISCO-06: o que a tela 1 decide sozinha. Qualquer alarme (menos autolesão) é emergência;
 * só autolesão é apoio (CVV e SAMU, e a pessoa segue); sem alarme, `null`. Não depende da idade.
 */
export function alarmOutcome(alarms: Answers["alarms"]): "emergency" | "support" | null {
  if (alarms.some((alarm) => alarm !== "self_harm")) return "emergency";
  return alarms.includes("self_harm") ? "support" : null;
}

/** Questionário v1: vale a primeira regra que bater, de cima para baixo. */
export function classify(answers: Answers, ageYears: number): Classification {
  const { alarms, reason, severity, conditions, groups } = answers;
  const fresh = reason === "new";
  const pregnant = groups.includes("pregnant");
  const alarm = alarmOutcome(alarms);

  if (alarm === "emergency") {
    return { level: "emergency", rule: "Sinal de alarme na Tela 1", support: false };
  }
  if (alarm === "support") {
    return {
      level: "urgent",
      rule: "Pensamentos de tirar a própria vida ou de se machucar",
      support: true,
    };
  }
  if (fresh && severity === "severe") {
    return { level: "urgent", rule: "Problema novo forte", support: false };
  }
  if (fresh && severity === "moderate" && pregnant) {
    return { level: "urgent", rule: "Gestante com problema novo moderado", support: false };
  }
  if (fresh && severity === "moderate") {
    return { level: "attention", rule: "Problema novo moderado", support: false };
  }
  if (fresh && conditions.length > 0) {
    return { level: "attention", rule: "Problema novo com condição de saúde", support: false };
  }
  if (fresh && (ageYears < 2 || ageYears >= 60)) {
    return {
      level: "attention",
      rule: "Problema novo com idade abaixo de 2 ou a partir de 60",
      support: false,
    };
  }
  if (fresh && severity === "mild" && pregnant) {
    return { level: "attention", rule: "Gestante com problema novo leve", support: false };
  }
  return { level: "routine", rule: "Sem sinais de risco", support: false };
}

/**
 * Marca ou desmarca `option`. A opção `exclusiva` ("Nenhum destes", "Nenhuma") desmarca
 * todas as outras ao ser marcada, e é desmarcada quando outra é marcada. Não altera `checked`.
 */
export function toggleOption(checked: string[], option: string, exclusive: string): string[] {
  if (checked.includes(option)) return checked.filter((m) => m !== option);
  if (option === exclusive) return [exclusive];
  return [...checked.filter((m) => m !== exclusive), option];
}
