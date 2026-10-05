import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/types.ts", "src/lib/landing-data.ts", "src/lib/datetime.ts"],
      // Baseline da Fase 5.4 (05/10/2026): 18.8 / 9.1 / 19.6 / 20.1 (stmt/branch/func/lines).
      // Folga de ~1pt para variacao do v8 entre Node 22 (CI) e 24 (local) - so sobe daqui.
      thresholds: {
        statements: 17,
        branches: 8,
        functions: 18,
        lines: 19,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
