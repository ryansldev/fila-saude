import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    root: rootDir,
    env: {
      NODE_ENV: "test",
    },
    // PD-19: todos os arquivos compartilham o Postgres de teste e o servidor em :3333.
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
  },
});
