import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CONFLICT_CODES } from "infra/openapi/schemas";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sources(file);
    return file.endsWith(".ts") ? [file] : [];
  });
}

// PD-22: a referência lista em cada 409 os códigos que a API manda. Um 409 novo lançado no código e
// esquecido na lista faz este teste falhar.
describe("códigos de 409 na referência", () => {
  it('todo `ApiError(409, "…")` da API está em CONFLICT_CODES', () => {
    const thrown = new Set<string>();
    for (const file of [...sources(path.join(root, "infra")), ...sources(path.join(root, "routes"))]) {
      for (const [, code] of readFileSync(file, "utf8").matchAll(/ApiError\(\s*409,\s*"([a-z_]+)"/g)) {
        if (code) thrown.add(code);
      }
    }
    expect(thrown.size).toBeGreaterThan(10);
    expect([...thrown].filter((code) => !CONFLICT_CODES.includes(code))).toEqual([]);
  });

  it("inclui as recusas do domínio e o pedido repetido ao mesmo tempo", () => {
    expect(CONFLICT_CODES).toEqual(expect.arrayContaining(["forbidden_transition", "no_slot", "duplicate"]));
  });
});
