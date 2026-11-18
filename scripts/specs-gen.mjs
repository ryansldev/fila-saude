#!/usr/bin/env node
// Gera as tabelas de transição e a matriz de permissões das specs a partir dos
// dados de packages/domain (AD-051). As tabelas ficam entre marcadores:
//   <!-- gerado: contratos:<spec>:<máquina>[,<máquina>] --> … <!-- /gerado -->
//   <!-- gerado: permissoes --> … <!-- /gerado -->
// Não edite o conteúdo entre os marcadores: edite contratos.ts / permissoes.ts.
// Uso: node scripts/specs-gen.mjs [--dir <.specs/specs>] [--check]
//   sem --check: reescreve os blocos; com --check: só lista o que está desatualizado (sai com 1).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  cellText,
  ENTRY_TRANSITIONS,
  ITEM_TRANSITIONS,
  MATRIX,
  SESSION_TRANSITIONS,
} from "../packages/domain/src/index.ts";

const ROOT = new URL("..", import.meta.url).pathname;
export const SPECS_DIR = join(ROOT, ".specs/specs");

const TRANSITIONS = { entry: ENTRY_TRANSITIONS, item: ITEM_TRANSITIONS, session: SESSION_TRANSITIONS };

const LABELS = {
  entry: {
    awaiting_referral: "Aguardando encaminhamento",
    waiting: "Aguardando",
    allocated: "Alocada",
    confirmed: "Confirmada",
    in_reserve: "Na reserva",
    in_queue: "Na fila",
    reassigned: "Remanejada",
    archived: "Arquivada",
    completed: "Concluída",
    cancelled: "Cancelada",
    closed_without_care: "Encerrada sem atendimento",
  },
  item: {
    remote: "Remoto",
    present: "Presente",
    called: "Chamado",
    done_in_stage: "Atendido na etapa",
    left_queue: "Saiu da fila",
    reassigned: "Remanejado",
  },
  session: { planned: "Planejada", open: "Aberta", cancelled: "Cancelada", closed: "Encerrada" },
};

const PROFILES = [
  "patient",
  "sms_management",
  "sms_regulation",
  "unit_manager",
  "scheduler",
  "reception",
  "nurse",
  "nursing_technician",
  "care",
];
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

const tableRow = (cells) => `| ${cells.join(" | ")} |`;
const separator = (n) => tableRow(Array(n).fill("---"));

function label(machine, state) {
  const r = LABELS[machine][state];
  if (!r) throw new Error(`estado sem rótulo (${machine}): ${state}`);
  return r;
}

function cellOf(machine, t) {
  if (t.textOf) return t.textOf;
  if (t.de === "—") return "—";
  return t.qualifier ? `${label(machine, t.de)} (${t.qualifier})` : label(machine, t.de);
}

function cellFor(machine, t) {
  if (t.for.startsWith("(")) return `(${t.forQualifier ?? t.for.slice(1, -1)})`;
  return t.forQualifier ? `${label(machine, t.for)} (${t.forQualifier})` : label(machine, t.for);
}

// The specs stay in Portuguese: their markers name the machines as "entrada", "item" and "sessao".
const MACHINE_FROM_MARKER = { entrada: "entry", item: "item", sessao: "session" };

/** Tabela de transições: linhas seguidas com o mesmo `textOf` (e o resto igual) viram uma linha só. */
function contractTable(spec, machines) {
  const condition = machines.length === 1 && machines[0] === "session" ? "Quem / condição" : "Condição";
  const rows = [tableRow(["De", "Evento", condition, "Para", "Efeitos"]), separator(5)];
  let previous = null;
  for (const machine of machines) {
    const data = TRANSITIONS[machine];
    if (!data) throw new Error(`máquina desconhecida: ${machine}`);
    for (const t of data.filter((x) => x.spec === spec)) {
      const rest = [t.event, t.condition, cellFor(machine, t), t.effects];
      const key = t.textOf ? JSON.stringify([machine, t.textOf, ...rest]) : null;
      if (key !== null && key === previous) continue;
      previous = key;
      rows.push(tableRow([cellOf(machine, t), ...rest]));
    }
  }
  return rows;
}

function permissionTable() {
  return [
    tableRow(MATRIX_HEADER),
    separator(MATRIX_HEADER.length),
    ...MATRIX.map((l) => tableRow([l.text, ...PROFILES.map((p) => cellText(l.profiles[p]))])),
  ];
}

function content(name) {
  if (name === "permissoes") return permissionTable();
  const m = name.match(/^contratos:([a-z-]+):([a-z,]+)$/);
  if (!m) throw new Error(`marcador desconhecido: ${name}`);
  return contractTable(
    m[1],
    m[2].split(",").map((x) => MACHINE_FROM_MARKER[x] ?? x),
  );
}

const OPENS = /^<!-- gerado: (.+?) -->$/;
const CLOSES = "<!-- /gerado -->";
const TABLE_MANUAL = /^\|\s*(De\s*\|\s*Evento|Ação\s*\|\s*Paciente)\s*\|/;

/** Regera os blocos de um texto. Devolve o texto novo, os blocos encontrados e os problemas. */
export function processText(text) {
  const entry = text.split("\n");
  const exit = [];
  const blocks = [];
  const problems = [];
  for (let i = 0; i < entry.length; i++) {
    const row = entry[i];
    const opens = row.match(OPENS);
    if (!opens) {
      if (TABLE_MANUAL.test(row)) problems.push(`tabela na linha ${i + 1} está fora dos marcadores`);
      exit.push(row);
      continue;
    }
    const end = entry.indexOf(CLOSES, i + 1);
    if (end < 0) {
      problems.push(`marcador "${opens[1]}" sem ${CLOSES}`);
      exit.push(row);
      continue;
    }
    let generated;
    try {
      generated = content(opens[1]);
    } catch (e) {
      problems.push(e.message);
      exit.push(...entry.slice(i, end + 1));
      i = end;
      continue;
    }
    const current = entry.slice(i + 1, end);
    blocks.push({ name: opens[1], outdated: current.join("\n") !== generated.join("\n") });
    exit.push(row, ...generated, CLOSES);
    i = end;
  }
  return { text: exit.join("\n"), blocks, problems };
}

function filesMd(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return filesMd(p);
    return name.endsWith(".md") ? [p] : [];
  });
}

/** Linhas de dados que nenhum bloco publica (ex.: um marcador apagado). */
function notPublished(names) {
  const cobertos = new Set(
    names.flatMap((n) => {
      const m = n.match(/^contratos:([a-z-]+):([a-z,]+)$/);
      return m ? m[2].split(",").map((machine) => `${m[1]}:${MACHINE_FROM_MARKER[machine] ?? machine}`) : [];
    }),
  );
  const missing = new Set();
  for (const [machine, data] of Object.entries(TRANSITIONS)) {
    for (const t of data) if (!cobertos.has(`${t.spec}:${machine}`)) missing.add(`contratos:${t.spec}:${machine}`);
  }
  if (!names.includes("permissoes")) missing.add("permissoes");
  return [...missing];
}

/** Gera (ou, com `checar`, só confere) os blocos de todas as specs em `dir`. Devolve os erros. */
export function run(dir = SPECS_DIR, { check = false } = {}) {
  const errors = [];
  const names = [];
  for (const file of filesMd(dir)) {
    const rel = relative(dir, file);
    const original = readFileSync(file, "utf8");
    const { text, blocks, problems } = processText(original);
    for (const p of problems) errors.push(`${rel}: ${p}`);
    for (const b of blocks) {
      if (names.includes(b.name)) errors.push(`${rel}: bloco ${b.name} repetido`);
      names.push(b.name);
      if (check && b.outdated) errors.push(`${rel}: bloco ${b.name} desatualizado (rode npm run specs:gen)`);
    }
    if (!check && text !== original) writeFileSync(file, text);
  }
  for (const n of notPublished(names)) errors.push(`nenhum bloco publica ${n}`);
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const iDir = args.indexOf("--dir");
  const dir = iDir >= 0 ? args[iDir + 1] : SPECS_DIR;
  const check = args.includes("--check");
  const errors = run(dir, { check });
  for (const e of errors) console.log(`ERRO: ${e}`);
  if (!errors.length) console.log(check ? "tabelas geradas em dia" : "tabelas geradas");
  process.exit(errors.length ? 1 : 0);
}
