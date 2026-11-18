import path from "node:path";
import { defineConfig } from "vitest/config";

// Só a lógica pura do app (src/lib); telas não têm teste de layout.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
