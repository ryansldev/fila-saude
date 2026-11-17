import {
  type Alarm,
  type Answers,
  alarmOutcome,
  type Condition,
  type DeclaredGroup,
  type Reason,
  type Severity,
  toggleOption,
} from "@fila-saude/domain";

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

/**
 * Marca ou desmarca numa pergunta de várias respostas. `NONE` ("nenhum destes", "nenhuma") é exclusivo
 * e não entra nas respostas: vira `none`, que conta como pergunta respondida.
 */
export function markMultiple(answers: string[], none: boolean, option: string): { answers: string[]; none: boolean } {
  const fresh = toggleOption(none ? [NONE] : answers, option, NONE);
  return { answers: fresh.filter((x) => x !== NONE), none: fresh.includes(NONE) };
}

type Options = readonly (readonly [string, string])[];
/** Cada opção leva o valor que a API guarda; um valor fora do tipo não compila. */
const options = <T extends string>(o: readonly (readonly [T, string])[]): Options => o;

export const QUESTIONS: Record<Screen, { multiple: boolean; options: Options; none?: string }> = {
  alarms: {
    multiple: true,
    none: "nenhum destes",
    options: options<Alarm>([
      ["shortness_of_breath", "falta de ar forte ou dificuldade para respirar"],
      ["chest_pain", "dor ou aperto forte no peito"],
      ["fainting", "desmaio, confusão ou sonolência estranha"],
      ["one_sided_weakness", "fraqueza, formigamento ou boca torta de repente"],
      ["bleeding", "sangramento que não para"],
      ["seizure", "convulsão"],
      ["self_harm", "pensamentos de tirar a própria vida ou de se machucar"],
    ]),
  },
  reason: {
    multiple: false,
    options: options<Reason>([
      ["new", "problema novo ou que piorou"],
      ["follow_up", "acompanhamento de doença que já tenho"],
      ["exam", "exame, check-up ou rotina"],
      ["prescription", "renovar receita"],
    ]),
  },
  severity: {
    multiple: false,
    options: options<Severity>([
      ["mild", "leve, faço as coisas normalmente"],
      ["moderate", "moderado, atrapalha o dia"],
      ["severe", "forte, não consigo fazer quase nada"],
    ]),
  },
  conditions: {
    multiple: true,
    none: "nenhuma",
    options: options<Condition>([
      ["diabetes", "diabetes"],
      ["high_blood_pressure", "pressão alta"],
      ["heart", "doença do coração"],
      ["respiratory", "asma, bronquite ou DPOC"],
      ["cancer", "câncer em tratamento"],
      ["low_immunity", "imunidade baixa (transplante, HIV, uso de corticoide)"],
    ]),
  },
  groups: {
    multiple: true,
    none: "nenhuma",
    options: options<DeclaredGroup>([
      ["pregnant", "gestante"],
      ["breastfeeding", "lactante"],
      ["infant_in_arms", "com criança de colo"],
      ["disability", "pessoa com deficiência"],
      ["autism", "TEA"],
      ["reduced_mobility", "mobilidade reduzida"],
      ["blood_donor", "doador de sangue"],
      ["obesity", "obesidade"],
    ]),
  },
};

/**
 * Na 1ª pergunta (2026-11-17): as respostas mudam a ordem da fila, então quem inventa sintoma passa na
 * frente de quem precisa. Texto provisório até a revisão jurídica (D5).
 */
export const TRUTH_WARNING = {
  title: "responda com a verdade",
  text: "suas respostas mudam a ordem da fila. informar um sintoma que não tem para passar na frente pode ser crime de falsidade ideológica (art. 299 do código penal).",
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
export const questionnaireOutcome = (r: AppAnswers): "emergency" | "support" | "continues" =>
  alarmOutcome(r.alarms) ?? "continues";
