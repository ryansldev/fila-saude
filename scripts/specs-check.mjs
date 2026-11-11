#!/usr/bin/env node
// Checagem de consistência das specs (AD-051). Sem dependências.
// Uso: node scripts/specs-check.mjs [--migration <git-rev>]
//   - todo ID citado (RN, INV, RNF, AD, PD, US, T, D) existe
//   - nenhuma decisão substituída é citada como vigente nas specs
//   - toda RN é coberta por alguma task (aviso)
//   - --migration: todo RN/INV/RNF/US da source.md antiga existe nas specs novas
//   - as tabelas geradas (transições e permissões) estão em dia com packages/domain
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { rodar as rodarSpecsGen } from "./specs-gen.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SPECS = join(ROOT, ".specs");
const SKIP = new Set(["LESSONS.md", "discovery-estrutura-specs.md", "source.md"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return name.endsWith(".md") && !SKIP.has(name) ? [path] : [];
  });
}

const files = walk(SPECS).map((path) => ({
  path,
  rel: relative(ROOT, path),
  text: readFileSync(path, "utf8"),
}));
const byRel = (suffix) => files.filter((f) => f.rel.endsWith(suffix));

// ---------- IDs definidos ----------
const defined = new Map(); // id -> arquivo
const define = (id, file) => {
  if (defined.has(id) && defined.get(id) !== file) {
    errors.push(`${id} definido em dois lugares: ${defined.get(id)} e ${file}`);
  }
  defined.set(id, file);
};
const errors = [];
const warnings = [];

for (const f of files.filter((f) => f.rel.includes(".specs/specs/"))) {
  for (const m of f.text.matchAll(/^\*\*(RN-[A-Z]+-\d+[a-z]?) ·/gm)) define(m[1], f.rel);
  for (const m of f.text.matchAll(/^- \*\*(INV-\d+):/gm)) define(m[1], f.rel);
  for (const m of f.text.matchAll(/\*\*(RNF-[A-Z]+-\d+):/g)) define(m[1], f.rel);
}
const superseded = new Set();
for (const f of byRel("decisions.md")) {
  for (const m of f.text.matchAll(/^### (AD-\d+) ·.*\n(.*)/gm)) {
    define(m[1], f.rel);
    if (/substitu[ií]da por/i.test(m[2])) superseded.add(m[1]);
  }
}
for (const f of byRel("plan.md")) for (const m of f.text.matchAll(/^\| (PD-\d+) \|/gm)) define(m[1], f.rel);
for (const f of byRel("mvp-filas/spec.md")) for (const m of f.text.matchAll(/^\| (US-\d+) \|/gm)) define(m[1], f.rel);
for (const f of byRel("tasks.md")) {
  for (const m of f.text.matchAll(/^\| (T\d+\.\d+) \|/gm)) define(m[1], f.rel);
  for (const m of f.text.matchAll(/^\| (D\d+) \|/gm)) define(m[1], f.rel);
}

const groups = new Set(
  [...defined.keys()].filter((id) => id.startsWith("RN-")).map((id) => id.replace(/-\d+[a-z]?$/, "")),
);

// ---------- referências ----------
const ID = String.raw`(RN-[A-Z]+-|INV-|RNF-[A-Z]+-|AD-|PD-|US-)(\d+)([a-z]?)`;
const pad = (n, like) => String(n).padStart(like.length, "0");

function refsIn(text) {
  const out = [];
  const re = new RegExp(`${ID}(?:\\.\\.(?:(?:RN-[A-Z]+-|AD-|PD-|US-|INV-)?(\\d+))|((?:/\\d+)+))?`, "g");
  for (const m of text.matchAll(re)) {
    const [, prefix, num, suffix, rangeEnd, slashes] = m;
    out.push(prefix + num + suffix);
    if (rangeEnd) for (let n = +num + 1; n <= +rangeEnd; n++) out.push(prefix + pad(n, num));
    if (slashes) for (const s of slashes.split("/").filter(Boolean)) out.push(prefix + pad(s, num));
  }
  for (const m of text.matchAll(/\b(T\d+\.\d+)\b/g)) out.push(m[1]);
  for (const m of text.matchAll(/(?<![A-Z-])\b(D\d{1,2})\b(?:[–-](D?\d{1,2}))?/g)) {
    out.push(m[1]);
    if (m[2]) for (let n = +m[1].slice(1) + 1; n <= +m[2].replace("D", ""); n++) out.push(`D${n}`);
  }
  return out;
}

for (const f of files) {
  for (const id of refsIn(f.text)) {
    if (!defined.has(id)) errors.push(`${f.rel}: cita ${id}, que não existe`);
  }
  for (const m of f.text.matchAll(/\b(RN-[A-Z]+)\b(?!-\d)/g)) {
    if (!groups.has(m[1])) errors.push(`${f.rel}: cita o grupo ${m[1]}, que não existe`);
  }
  if (f.rel.includes(".specs/specs/")) {
    for (const id of refsIn(f.text)) {
      if (superseded.has(id)) errors.push(`${f.rel}: cita ${id}, decisão substituída`);
    }
  }
}

// ---------- cobertura pelas tasks ----------
const tasksText = byRel("tasks.md")
  .map((f) => f.text)
  .join("\n");
const covered = new Set(refsIn(tasksText));
const coveredGroups = new Set([...tasksText.matchAll(/\b(RN-[A-Z]+)\b(?!-\d)/g)].map((m) => m[1]));
const specsCited = new Set([...tasksText.matchAll(/specs\/([a-z-]+)/g)].map((m) => m[1]));
for (const [id, file] of defined) {
  if (!id.startsWith("RN-")) continue;
  const group = id.replace(/-\d+[a-z]?$/, "");
  const capability = file.split("/").at(-2);
  if (!covered.has(id) && !coveredGroups.has(group) && !specsCited.has(capability)) {
    warnings.push(`${id} (${file}) não é coberta por nenhuma task`);
  }
}

// ---------- migração ----------
const migIdx = process.argv.indexOf("--migration");
if (migIdx !== -1) {
  const rev = process.argv[migIdx + 1] ?? "HEAD";
  const old = execFileSync("git", ["-C", ROOT, "show", `${rev}:.specs/features/mvp-filas/source.md`], {
    encoding: "utf8",
  });
  const oldIds = new Set(
    [...old.matchAll(/\b(RN-[A-Z]+-\d+[a-z]?|INV-\d+|RNF-[A-Z]+-\d+|US-\d+)\b/g)].map((m) => m[1]),
  );
  const lost = [...oldIds].filter((id) => !defined.has(id));
  if (lost.length) errors.push(`migração: ${lost.length} IDs da source.md antiga sumiram: ${lost.join(", ")}`);
  else console.log(`migração: os ${oldIds.size} IDs da source.md (${rev}) existem nas specs novas`);
}

// ---------- tabelas geradas (AD-051) ----------
for (const e of rodarSpecsGen(join(SPECS, "specs"), { checar: true })) errors.push(`.specs/specs/${e}`);

// ---------- saída ----------
const unique = (a) => [...new Set(a)];
for (const w of unique(warnings)) console.log(`aviso: ${w}`);
for (const e of unique(errors)) console.log(`ERRO: ${e}`);
console.log(
  `\n${defined.size} IDs definidos · ${superseded.size} decisões substituídas · ${unique(errors).length} erros · ${unique(warnings).length} avisos`,
);
process.exit(errors.length ? 1 : 0);
