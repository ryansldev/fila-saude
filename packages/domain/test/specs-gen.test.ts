import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const RAIZ = resolve(import.meta.dirname, "../../..");
const SPECS = join(RAIZ, ".specs/specs");
const SCRIPT = join(RAIZ, "scripts/specs-gen.mjs");

const rodar = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

function arquivos(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const andar = (d: string) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) andar(p);
      else out.set(relative(dir, p), readFileSync(p, "utf8"));
    }
  };
  andar(dir);
  return out;
}

let tmp = "";
const copia = () => {
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
    const dir = copia();
    const gerar = rodar("--dir", dir);
    expect(gerar.status, gerar.stderr + gerar.stdout).toBe(0);
    const checar = rodar("--dir", dir, "--check");
    expect(checar.status, checar.stderr + checar.stdout).toBe(0);
    // as specs do repositório já estão geradas: gerar de novo não muda nenhum arquivo
    expect(arquivos(dir)).toEqual(arquivos(SPECS));
  });

  it("specs-gen AD-051: as tabelas de transição e a matriz estão todas entre marcadores", () => {
    const blocos = [...arquivos(SPECS).values()].join("\n").match(/<!-- gerado: [^>]+ -->/g) ?? [];
    // 6 specs com transições: marcacao, fila-do-dia e chamada têm duas tabelas; + a matriz
    expect(blocos).toHaveLength(10);
  });

  it("specs-gen AD-051: checar acusa tabela editada à mão", () => {
    const dir = copia();
    const arquivo = join(dir, "chamada/spec.md");
    writeFileSync(arquivo, readFileSync(arquivo, "utf8").replace("Novo anúncio", "Anúncio novo"));
    const checar = rodar("--dir", dir, "--check");
    expect(checar.status).toBe(1);
    expect(checar.stdout).toMatch(/chamada\/spec\.md.*contratos:chamada:item.*desatualizad/);
  });

  it("specs-gen AD-051: checar acusa tabela de transição fora dos marcadores", () => {
    const dir = copia();
    const arquivo = join(dir, "contingencia/spec.md");
    writeFileSync(arquivo, readFileSync(arquivo, "utf8").replace(/<!-- \/?gerado[^>]*-->\n/g, ""));
    const checar = rodar("--dir", dir, "--check");
    expect(checar.status).toBe(1);
    expect(checar.stdout).toMatch(/contingencia\/spec\.md.*fora dos marcadores/);
  });
});
