import { classificar, idadeEm, type Respostas } from "@fila-saude/domain";

// Questionário v1 (specs/lista-espera, textos do protótipo revisado).

export type Tela = "alarmes" | "motivo" | "gravidade" | "condicoes" | "grupos";
export type RespostasDoApp = Omit<Respostas, "motivo"> & { motivo: Respostas["motivo"] | null };

export const RESPOSTAS_VAZIAS: RespostasDoApp = {
  alarmes: [],
  motivo: null,
  gravidade: null,
  condicoes: [],
  grupos: [],
};

export const NENHUM = "nenhum";

type Opcoes = readonly (readonly [string, string])[];

export const PERGUNTAS: Record<
  Tela,
  { pergunta: string; perguntaOutra: string; multipla: boolean; opcoes: Opcoes; nenhum?: string }
> = {
  alarmes: {
    pergunta: "você está com algum destes agora?",
    perguntaOutra: "a pessoa está com algum destes agora?",
    multipla: true,
    nenhum: "nenhum destes",
    opcoes: [
      ["falta_de_ar", "falta de ar forte ou dificuldade para respirar"],
      ["dor_no_peito", "dor ou aperto forte no peito"],
      ["desmaio", "desmaio, confusão ou sonolência estranha"],
      ["fraqueza_de_um_lado", "fraqueza, formigamento ou boca torta de repente"],
      ["sangramento", "sangramento que não para"],
      ["convulsao", "convulsão"],
      ["autolesao", "pensamentos de tirar a própria vida ou de se machucar"],
    ],
  },
  motivo: {
    pergunta: "por que você quer o atendimento?",
    perguntaOutra: "por que ela precisa do atendimento?",
    multipla: false,
    opcoes: [
      ["novo", "problema novo ou que piorou"],
      ["acompanhamento", "acompanhamento de doença que já tenho"],
      ["exame", "exame, check-up ou rotina"],
      ["receita", "renovar receita"],
    ],
  },
  gravidade: {
    pergunta: "como está esse problema?",
    perguntaOutra: "como está esse problema?",
    multipla: false,
    opcoes: [
      ["leve", "leve, faço as coisas normalmente"],
      ["moderado", "moderado, atrapalha o dia"],
      ["forte", "forte, não consigo fazer quase nada"],
    ],
  },
  condicoes: {
    pergunta: "você tem alguma destas condições?",
    perguntaOutra: "ela tem alguma destas condições?",
    multipla: true,
    nenhum: "nenhuma",
    opcoes: [
      ["diabetes", "diabetes"],
      ["pressao_alta", "pressão alta"],
      ["coracao", "doença do coração"],
      ["respiratoria", "asma, bronquite ou DPOC"],
      ["cancer", "câncer em tratamento"],
      ["imunidade_baixa", "imunidade baixa (transplante, HIV, uso de corticoide)"],
    ],
  },
  grupos: {
    pergunta: "alguma destas se aplica a você?",
    perguntaOutra: "alguma destas se aplica a quem vai ser atendido?",
    multipla: true,
    nenhum: "nenhuma",
    opcoes: [
      ["gestante", "gestante"],
      ["lactante", "lactante"],
      ["crianca_de_colo", "com criança de colo"],
      ["pcd", "pessoa com deficiência"],
      ["tea", "TEA"],
      ["mobilidade_reduzida", "mobilidade reduzida"],
      ["doador_de_sangue", "doador de sangue"],
      ["obesidade", "obesidade"],
    ],
  },
};

/** A pergunta na pessoa certa: "você" para mim, terceira pessoa para quem a conta inscreve. */
export const perguntaDe = (tela: Tela, quem: "eu" | "outra" | null) =>
  quem === "outra" ? PERGUNTAS[tela].perguntaOutra : PERGUNTAS[tela].pergunta;

/** A gravidade só é perguntada para problema novo (Tela 3). */
export function telasDo(r: RespostasDoApp): Tela[] {
  return r.motivo === "novo"
    ? ["alarmes", "motivo", "gravidade", "condicoes", "grupos"]
    : ["alarmes", "motivo", "condicoes", "grupos"];
}

export const completas = (r: RespostasDoApp): r is Respostas =>
  r.motivo !== null && (r.motivo !== "novo" || r.gravidade !== null);

/**
 * RN-RISCO-02 / RN-RISCO-06: emergência não entra na lista (orienta 192); autolesão mostra CVV e SAMU
 * e deixa seguir. O nível de verdade é calculado de novo na API.
 */
export function desfechoDoQuestionario(
  r: RespostasDoApp,
  nascimento: string,
  agora: number,
): "emergencia" | "apoio" | "segue" {
  const c = classificar(
    { ...r, motivo: r.motivo ?? "acompanhamento" },
    idadeEm(nascimento, agora, "America/Sao_Paulo"),
  );
  if (c.nivel === "emergencia") return "emergencia";
  return c.apoio ? "apoio" : "segue";
}
