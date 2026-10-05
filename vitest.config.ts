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
      // Baseline da Fase 8.4 (05/10/2026): 49.58 / 38.72 / 49.31 / 51.4
      // (stmt/branch/func/lines) apos os testes de reminders, outbox,
      // conversations, plan-limits, subscriptions e /api/health.
      // Margem de ~3-4pt para variacao do v8 entre Node 22 (CI) e 24
      // (local) - gates so sobem.
      thresholds: {
        statements: 46,
        branches: 35,
        functions: 45,
        lines: 47,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
