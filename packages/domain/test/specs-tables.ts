// Leitor das tabelas de transição das specs (.specs/specs/*/spec.md).
// Tolerante a comentários HTML em volta das tabelas (marcadores gerados).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Machine = "entry" | "item" | "session";

export type RowSpec = {
  spec: string;
  machine: Machine;
  de: string;
  qualifier: string;
  event: string;
  for: string;
  forQualifier: string;
  condition: string;
  effects: string;
  rule: string;
};

const ROOT = resolve(import.meta.dirname, "../../../.specs/specs");
export const SPECS = ["lista-espera", "marcacao", "excecoes", "fila-do-dia", "chamada", "contingencia"] as const;

const STATES: Record<Machine, [string, string][]> = {
  entry: [
    ["Aguardando encaminhamento", "awaiting_referral"],
    ["Encerrada sem atendimento", "closed_without_care"],
    ["Aguardando", "waiting"],
    ["Alocada", "allocated"],
    ["Confirmada", "confirmed"],
    ["Na reserva", "in_reserve"],
    ["Na fila", "in_queue"],
    ["Remanejada", "reassigned"],
    ["Arquivada", "archived"],
    ["Concluída", "completed"],
    ["Cancelada", "cancelled"],
  ],
  item: [
    ["Atendido na etapa", "done_in_stage"],
    ["Saiu da fila", "left_queue"],
    ["Remanejado", "reassigned"],
    ["Remoto", "remote"],
    ["Presente", "present"],
    ["Chamado", "called"],
  ],
  session: [
    ["Planejada", "planned"],
    ["Aberta", "open"],
    ["Cancelada", "cancelled"],
    ["Encerrada", "closed"],
  ],
};
const NON_FINAL_ITEM = ["remote", "present", "called"];

export const firstRule = (text: string): string => text.match(/\b(?:RN|INV|AD|L)-[A-Z]*-?\d+\b/)?.[0] ?? "";

function cutParentheses(text: string): { base: string; parentheses: string[] } {
  const parentheses: string[] = [];
  const base = text
    .replace(/\(([^)]*)\)/g, (_m, inside: string) => {
      parentheses.push(inside.trim());
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { base, parentheses };
}

function stateOf(machine: Machine, name: string): { state: string; rest: string } {
  if (name === "vaga segura") return { state: "awaiting_referral", rest: "vaga segura" };
  for (const [label, state] of STATES[machine]) {
    if (name === label || name.startsWith(`${label} `)) {
      return { state, rest: name.slice(label.length).trim() };
    }
  }
  throw new Error(`estado desconhecido (${machine}): "${name}"`);
}

function expandOf(machine: Machine, cell: string): { de: string; qualifier: string }[] {
  if (cell === "—") return [{ de: "—", qualifier: "" }];
  const { base, parentheses } = cutParentheses(cell);
  const common = parentheses.join("; ");
  if (base === "Qualquer não final") {
    return NON_FINAL_ITEM.map((de) => ({ de, qualifier: common }));
  }
  return base.split(/,\s*|\s+ou\s+/).map((part) => {
    const { state, rest } = stateOf(machine, part.trim());
    return { de: state, qualifier: [rest, common].filter(Boolean).join("; ") };
  });
}

function normalizeFor(machine: Machine, cell: string): string {
  const { base, parentheses } = cutParentheses(cell);
  if (base === "" && /^mesmo/.test(parentheses[0] ?? "")) return "(mesmo)";
  if (base === "" && parentheses[0] === "não cria") return "(não cria)";
  return stateOf(machine, base).state;
}

function classify(spec: string, title: string, label: string, cellOf: string): Machine {
  if (spec === "fila-do-dia" && title === "Sessão") return "session";
  if (/fila do dia/i.test(label)) return "item";
  if (spec === "contingencia") return /\(fila do dia\)/.test(cellOf) ? "item" : "entry";
  return "entry";
}

export function readTables(): RowSpec[] {
  const rows: RowSpec[] = [];
  for (const spec of SPECS) {
    const text = readFileSync(resolve(ROOT, spec, "spec.md"), "utf8").split("\n");
    let title = "";
    let label = "";
    let i = 0;
    while (i < text.length) {
      const row = text[i] ?? "";
      if (row.startsWith("## ")) {
        title = row.slice(3).trim();
        label = "";
      } else if (/^\|\s*De\s*\|\s*Evento\s*\|/.test(row)) {
        i += 2; // cabeçalho + separador
        while (i < text.length && (text[i] ?? "").startsWith("|")) {
          const c = (text[i] ?? "")
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((x) => x.trim());
          const [cellOf = "", event = "", condition = "", forCell = "", effects = ""] = c;
          const machine = classify(spec, title, label, cellOf);
          const de = cellOf.replace(/\s*\((fila do dia|entrada)\)\s*/g, " ").trim();
          for (const origin of expandOf(machine, de)) {
            rows.push({
              spec,
              machine,
              ...origin,
              event,
              for: normalizeFor(machine, forCell),
              forQualifier: cutParentheses(forCell).parentheses.join("; "),
              condition,
              effects,
              rule: firstRule(`${condition} ${effects}`),
            });
          }
          i++;
        }
        continue;
      } else if (row.trim() !== "" && !row.startsWith("<!--")) {
        label = row.trim();
      }
      i++;
    }
  }
  return rows;
}

export const MATRIX_PROFILES = [
  "patient",
  "sms_management",
  "sms_regulation",
  "unit_manager",
  "scheduler",
  "reception",
  "nurse",
  "nursing_technician",
  "care",
] as const;

export type MatrixRowSpec = { text: string; cells: string[] };

const MATRIX_HEADER = [
  "Ação",
  "Paciente",
  "Gestão SMS",
  "Regulação SMS",
  "Gerente da UBS",
  "Agendar",
  "Recepção",
  "Enfermeiro",
  "Técnico de enfermagem",
  "Atendimento",
];

const rowCells = (row: string): string[] =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((x) => x.trim());

/** Linhas da matriz de `specs/permissoes` (texto da ação + as 9 células, na ordem das colunas). */
export function readMatrix(): MatrixRowSpec[] {
  const text = readFileSync(resolve(ROOT, "permissoes", "spec.md"), "utf8").split("\n");
  const start = text.findIndex((l) => /^\|\s*Ação\s*\|\s*Paciente\s*\|/.test(l));
  if (start < 0) throw new Error("matriz de permissões não encontrada");
  const header = rowCells(text[start] ?? "");
  if (header.join("|") !== MATRIX_HEADER.join("|")) {
    throw new Error(`cabeçalho da matriz difere de PERFIS_MATRIZ: ${header.join(" | ")}`);
  }
  const rows: MatrixRowSpec[] = [];
  for (let i = start + 2; i < text.length && (text[i] ?? "").startsWith("|"); i++) {
    const c = rowCells(text[i] ?? "");
    if (c.length !== 1 + MATRIX_PROFILES.length)
      throw new Error(`linha da matriz com ${c.length - 1} células: ${c[0]}`);
    rows.push({ text: c[0] ?? "", cells: c.slice(1) });
  }
  return rows;
}
