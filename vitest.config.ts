import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/**/*.test.ts"],
    // Spawn-based e2e tests take ~5-6s per subprocess (Node.js ESM + effect
    // startup). Multi-step e2e (init -> user-prompt -> stop = 3 spawns) run
    // ~18s, and more under full-suite parallel load. 60s covers the heaviest
    // multi-spawn cell while still catching a real infinite-loop hang.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
