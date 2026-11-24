import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const SPECS = join(ROOT, ".specs/specs");
const SCRIPT = join(ROOT, "scripts/specs-gen.mjs");

const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

function files(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const floor = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) floor(p);
      else out.set(relative(dir, p), readFileSync(p, "utf8"));
    }
  };
  floor(dir);
  return out;
}

let tmp = "";
const copy = () => {
  tmp = mkdtempSync(join(tmpdir(), "specs-gen-"));
  cpSync(SPECS, tmp, { recursive: true });
  return tmp;
};
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = "";
});

describe("specs-gen (AD-051)", () => {
  it("specs-gen AD-051: gerar e depois checar não muda nada", () => {
    const dir = copy();
    const generate = run("--dir", dir);
    expect(generate.status, generate.stderr + generate.stdout).toBe(0);
    const check = run("--dir", dir, "--check");
    expect(check.status, check.stderr + check.stdout).toBe(0);
    // as specs do repositório já estão geradas: gerar de novo não muda nenhum arquivo
    expect(files(dir)).toEqual(files(SPECS));
  });

  it("specs-gen AD-051: as tabelas de transição e a matriz estão todas entre marcadores", () => {
    const blocks = [...files(SPECS).values()].join("\n").match(/<!-- gerado: [^>]+ -->/g) ?? [];
    // 6 specs com transições: marcacao e fila-do-dia têm duas tabelas, chamada três (com a pausa); + a matriz
    expect(blocks).toHaveLength(11);
  });

  it("specs-gen AD-051: checar acusa tabela editada à mão", () => {
    const dir = copy();
    const file = join(dir, "chamada/spec.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("Novo anúncio", "Anúncio novo"));
    const check = run("--dir", dir, "--check");
    expect(check.status).toBe(1);
    expect(check.stdout).toMatch(/chamada\/spec\.md.*contratos:chamada:item.*desatualizad/);
  });

  it("specs-gen AD-051: checar acusa tabela de transição fora dos marcadores", () => {
    const dir = copy();
    const file = join(dir, "contingencia/spec.md");
    writeFileSync(file, readFileSync(file, "utf8").replace(/<!-- \/?gerado[^>]*-->\n/g, ""));
    const check = run("--dir", dir, "--check");
    expect(check.status).toBe(1);
    expect(check.stdout).toMatch(/contingencia\/spec\.md.*fora dos marcadores/);
  });
});
