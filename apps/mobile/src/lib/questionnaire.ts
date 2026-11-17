import { type Answers, ageAt, classify } from "@fila-saude/domain";

// Questionário v1 (specs/lista-espera, textos do protótipo revisado).

export type Screen = "alarms" | "reason" | "severity" | "conditions" | "groups";
export type AppAnswers = Omit<Answers, "reason"> & { reason: Answers["reason"] | null };

export const EMPTY_ANSWERS: AppAnswers = {
  alarms: [],
  reason: null,
  severity: null,
  conditions: [],
  groups: [],
};

export const NONE = "nenhum";

type Options = readonly (readonly [string, string])[];

export const QUESTIONS: Record<Screen, { multiple: boolean; options: Options; none?: string }> = {
  alarms: {
    multiple: true,
    none: "nenhum destes",
    options: [
      ["shortness_of_breath", "falta de ar forte ou dificuldade para respirar"],
      ["chest_pain", "dor ou aperto forte no peito"],
      ["desmaio", "desmaio, confusão ou sonolência estranha"],
      ["one_sided_weakness", "fraqueza, formigamento ou boca torta de repente"],
      ["sangramento", "sangramento que não para"],
      ["convulsao", "convulsão"],
      ["autolesao", "pensamentos de tirar a própria vida ou de se machucar"],
    ],
  },
  reason: {
    multiple: false,
    options: [
      ["novo", "problema novo ou que piorou"],
      ["acompanhamento", "acompanhamento de doença que já tenho"],
      ["exame", "exame, check-up ou rotina"],
      ["receita", "renovar receita"],
    ],
  },
  severity: {
    multiple: false,
    options: [
      ["leve", "leve, faço as coisas normalmente"],
      ["moderado", "moderado, atrapalha o dia"],
      ["forte", "forte, não consigo fazer quase nada"],
    ],
  },
  conditions: {
    multiple: true,
    none: "nenhuma",
    options: [
      ["diabetes", "diabetes"],
      ["high_blood_pressure", "pressão alta"],
      ["coracao", "doença do coração"],
      ["respiratoria", "asma, bronquite ou DPOC"],
      ["cancer", "câncer em tratamento"],
      ["low_immunity", "imunidade baixa (transplante, HIV, uso de corticoide)"],
    ],
  },
  groups: {
    multiple: true,
    none: "nenhuma",
    options: [
      ["gestante", "gestante"],
      ["lactante", "lactante"],
      ["infant_in_arms", "com criança de colo"],
      ["pcd", "pessoa com deficiência"],
      ["tea", "TEA"],
      ["reduced_mobility", "mobilidade reduzida"],
      ["blood_donor", "doador de sangue"],
      ["obesidade", "obesidade"],
    ],
  },
};

const SPEECHES: Record<Screen, { me: string; other: (name: string) => string }> = {
  alarms: {
    me: "antes de tudo: você está com algum destes agora?",
    other: (n) => `antes de tudo: ${n} está com algum destes agora?`,
  },
  reason: { me: "e por que você quer o atendimento?", other: (n) => `e por que ${n} precisa do atendimento?` },
  severity: { me: "entendi. e como está esse problema?", other: () => "entendi. e como está esse problema?" },
  conditions: { me: "você tem alguma destas condições?", other: (n) => `${n} tem alguma destas condições?` },
  groups: {
    me: "por último: alguma destas se aplica a você?",
    other: (n) => `por último: alguma destas se aplica a ${n}?`,
  },
};

/** A fala do Dr. Lino em cada pergunta (2026-11-16): "você" para mim; para outra pessoa, o primeiro nome dela. */
export const questionSpeech = (screen: Screen, forWhom: "me" | "other" | null, name: string): string =>
  forWhom === "other" ? SPEECHES[screen].other(name || "a pessoa") : SPEECHES[screen].me;

/** A gravidade só é perguntada para problema novo (Tela 3). */
export function screensOf(r: AppAnswers): Screen[] {
  return r.reason === "new"
    ? ["alarms", "reason", "severity", "conditions", "groups"]
    : ["alarms", "reason", "conditions", "groups"];
}

export const complete = (r: AppAnswers): r is Answers =>
  r.reason !== null && (r.reason !== "new" || r.severity !== null);

/**
 * RN-RISCO-02 / RN-RISCO-06: emergência não entra na lista (orienta 192); autolesão mostra CVV e SAMU
 * e deixa seguir. O nível de verdade é calculado de novo na API.
 */
export function questionnaireOutcome(
  r: AppAnswers,
  birthDate: string,
  now: number,
): "emergency" | "support" | "continues" {
  const c = classify({ ...r, reason: r.reason ?? "follow_up" }, ageAt(birthDate, now, "America/Sao_Paulo"));
  if (c.level === "emergency") return "emergency";
  return c.support ? "support" : "continues";
}
