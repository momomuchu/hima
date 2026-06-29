import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/**/*.test.ts"],
    // Spawn-based e2e tests (e2e-cli-spawn, e2e-trace) take 5-8s per subprocess
    // invocation on typical CI/dev machines due to Node.js ESM startup time.
    // 15s gives comfortable headroom without masking real infinite-loop hangs.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
