import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/domain/health.ts", "worker/copilot.ts"],
      thresholds: { lines: 80, functions: 75, statements: 80, branches: 70 },
    },
  },
});
