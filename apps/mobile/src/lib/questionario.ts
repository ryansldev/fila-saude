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

export const PERGUNTAS: Record<Tela, { pergunta: string; multipla: boolean; opcoes: Opcoes; nenhum?: string }> = {
  alarmes: {
    pergunta: "Você está com algum destes agora?",
    multipla: true,
    nenhum: "Nenhum destes",
    opcoes: [
      ["falta_de_ar", "Falta de ar forte ou dificuldade para respirar"],
      ["dor_no_peito", "Dor ou aperto forte no peito"],
      ["desmaio", "Desmaio, confusão ou sonolência estranha"],
      ["fraqueza_de_um_lado", "Fraqueza, formigamento ou boca torta de repente"],
      ["sangramento", "Sangramento que não para"],
      ["convulsao", "Convulsão"],
      ["autolesao", "Pensamentos de tirar a própria vida ou de se machucar"],
    ],
  },
  motivo: {
    pergunta: "Por que você quer o atendimento?",
    multipla: false,
    opcoes: [
      ["novo", "Problema novo ou que piorou"],
      ["acompanhamento", "Acompanhamento de doença que já tenho"],
      ["exame", "Exame, check-up ou rotina"],
      ["receita", "Renovar receita"],
    ],
  },
  gravidade: {
    pergunta: "Como está esse problema?",
    multipla: false,
    opcoes: [
      ["leve", "Leve, faço as coisas normalmente"],
      ["moderado", "Moderado, atrapalha o dia"],
      ["forte", "Forte, não consigo fazer quase nada"],
    ],
  },
  condicoes: {
    pergunta: "Você tem alguma destas condições?",
    multipla: true,
    nenhum: "Nenhuma",
    opcoes: [
      ["diabetes", "Diabetes"],
      ["pressao_alta", "Pressão alta"],
      ["coracao", "Doença do coração"],
      ["respiratoria", "Asma, bronquite ou DPOC"],
      ["cancer", "Câncer em tratamento"],
      ["imunidade_baixa", "Imunidade baixa (transplante, HIV, uso de corticoide)"],
    ],
  },
  grupos: {
    pergunta: "Alguma destas se aplica a quem vai ser atendido?",
    multipla: true,
    nenhum: "Nenhuma",
    opcoes: [
      ["gestante", "Gestante"],
      ["lactante", "Lactante"],
      ["crianca_de_colo", "Com criança de colo"],
      ["pcd", "Pessoa com deficiência"],
      ["tea", "TEA"],
      ["mobilidade_reduzida", "Mobilidade reduzida"],
      ["doador_de_sangue", "Doador(a) de sangue"],
      ["obesidade", "Obesidade"],
    ],
  },
};

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
