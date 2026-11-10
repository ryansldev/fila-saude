// Leitor das tabelas de transição das specs (.specs/specs/*/spec.md).
// Tolerante a comentários HTML em volta das tabelas (marcadores gerados).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Maquina = "entrada" | "item" | "sessao";

export type LinhaSpec = {
  spec: string;
  maquina: Maquina;
  de: string;
  qualificador: string;
  evento: string;
  para: string;
  paraQualificador: string;
  condicao: string;
  efeitos: string;
};

const RAIZ = resolve(import.meta.dirname, "../../../.specs/specs");
export const SPECS = ["lista-espera", "marcacao", "excecoes", "fila-do-dia", "chamada", "contingencia"] as const;

const ESTADOS: Record<Maquina, [string, string][]> = {
  entrada: [
    ["Aguardando encaminhamento", "aguardando_encaminhamento"],
    ["Encerrada sem atendimento", "encerrada_sem_atendimento"],
    ["Aguardando", "aguardando"],
    ["Alocada", "alocada"],
    ["Confirmada", "confirmada"],
    ["Na reserva", "na_reserva"],
    ["Na fila", "na_fila"],
    ["Remanejada", "remanejada"],
    ["Arquivada", "arquivada"],
    ["Concluída", "concluida"],
    ["Cancelada", "cancelada"],
  ],
  item: [
    ["Atendido na etapa", "atendido_na_etapa"],
    ["Saiu da fila", "saiu_da_fila"],
    ["Remanejado", "remanejado"],
    ["Remoto", "remoto"],
    ["Presente", "presente"],
    ["Chamado", "chamado"],
  ],
  sessao: [
    ["Planejada", "planejada"],
    ["Aberta", "aberta"],
    ["Cancelada", "cancelada"],
    ["Encerrada", "encerrada"],
  ],
};
const NAO_FINAIS_ITEM = ["remoto", "presente", "chamado"];

function cortarParenteses(texto: string): { base: string; parenteses: string[] } {
  const parenteses: string[] = [];
  const base = texto
    .replace(/\(([^)]*)\)/g, (_m, dentro: string) => {
      parenteses.push(dentro.trim());
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { base, parenteses };
}

function estadoDe(maquina: Maquina, nome: string): { estado: string; resto: string } {
  if (nome === "vaga segura") return { estado: "aguardando_encaminhamento", resto: "vaga segura" };
  for (const [rotulo, estado] of ESTADOS[maquina]) {
    if (nome === rotulo || nome.startsWith(`${rotulo} `)) {
      return { estado, resto: nome.slice(rotulo.length).trim() };
    }
  }
  throw new Error(`estado desconhecido (${maquina}): "${nome}"`);
}

function expandirDe(maquina: Maquina, celula: string): { de: string; qualificador: string }[] {
  if (celula === "—") return [{ de: "—", qualificador: "" }];
  const { base, parenteses } = cortarParenteses(celula);
  const comum = parenteses.join("; ");
  if (base === "Qualquer não final") {
    return NAO_FINAIS_ITEM.map((de) => ({ de, qualificador: comum }));
  }
  return base.split(/,\s*|\s+ou\s+/).map((parte) => {
    const { estado, resto } = estadoDe(maquina, parte.trim());
    return { de: estado, qualificador: [resto, comum].filter(Boolean).join("; ") };
  });
}

function normalizarPara(maquina: Maquina, celula: string): string {
  const { base, parenteses } = cortarParenteses(celula);
  if (base === "" && /^mesmo/.test(parenteses[0] ?? "")) return "(mesmo)";
  if (base === "" && parenteses[0] === "não cria") return "(não cria)";
  return estadoDe(maquina, base).estado;
}

function classificar(spec: string, titulo: string, rotulo: string, celulaDe: string): Maquina {
  if (spec === "fila-do-dia" && titulo === "Sessão") return "sessao";
  if (/fila do dia/i.test(rotulo)) return "item";
  if (spec === "contingencia") return /\(fila do dia\)/.test(celulaDe) ? "item" : "entrada";
  return "entrada";
}

export function lerTabelas(): LinhaSpec[] {
  const linhas: LinhaSpec[] = [];
  for (const spec of SPECS) {
    const texto = readFileSync(resolve(RAIZ, spec, "spec.md"), "utf8").split("\n");
    let titulo = "";
    let rotulo = "";
    let i = 0;
    while (i < texto.length) {
      const linha = texto[i] ?? "";
      if (linha.startsWith("## ")) {
        titulo = linha.slice(3).trim();
        rotulo = "";
      } else if (/^\|\s*De\s*\|\s*Evento\s*\|/.test(linha)) {
        i += 2; // cabeçalho + separador
        while (i < texto.length && (texto[i] ?? "").startsWith("|")) {
          const c = (texto[i] ?? "")
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((x) => x.trim());
          const [celulaDe = "", evento = "", condicao = "", paraCelula = "", efeitos = ""] = c;
          const maquina = classificar(spec, titulo, rotulo, celulaDe);
          const de = celulaDe.replace(/\s*\((fila do dia|entrada)\)\s*/g, " ").trim();
          for (const origem of expandirDe(maquina, de)) {
            linhas.push({
              spec,
              maquina,
              ...origem,
              evento,
              para: normalizarPara(maquina, paraCelula),
              paraQualificador: cortarParenteses(paraCelula).parenteses.join("; "),
              condicao,
              efeitos,
            });
          }
          i++;
        }
        continue;
      } else if (linha.trim() !== "" && !linha.startsWith("<!--")) {
        rotulo = linha.trim();
      }
      i++;
    }
  }
  return linhas;
}
