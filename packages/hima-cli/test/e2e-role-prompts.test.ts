/**
 * e2e-role-prompts.test.ts — SPAWN proof for R-020 (richer role-variant prompt wiring).
 *
 * Before this wiring, PLANNER_PROMPTS/EXECUTOR_PROMPTS/CRITIC_PROMPTS,
 * variant-resolver.ts, and loader.ts were built + re-exported from
 * hima-core/src/index.ts but had zero call sites in router.ts — only the
 * terse one-line roleContext() fallback was ever delivered to agents.
 *
 * This suite proves that the richer bundled role-variant prompt (resolved via
 * resolveVariant + loadPrompt from PLANNER_PROMPTS) now appears in
 * user-prompt-submit's additionalContext for a planner-stage ward, IN ADDITION
 * to the pre-existing one-line "[HIMA role:planner]" fallback.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

// A distinctive line unique to the bundled PLANNER_PROMPTS "claude" variant
// (see packages/hima-core/src/prompts-core/planner-prompts.ts) — proves the
// RICH prompt was materialised, not just the one-line roleContext() fallback.
const RICH_PLANNER_MARKER =
  "Mission: analyse the problem, produce or update the structured plan";

// ---------------------------------------------------------------------------
// Spawn helper
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", cliRoot], {
    input: JSON.stringify(stdinPayload),
    encoding: "utf8",
    timeout: 15_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Scenario — new full-entry ward (discovery = planner stage) gets the rich prompt
// ---------------------------------------------------------------------------

describe("R-020 — user-prompt-submit injects the richer PLANNER_PROMPTS variant", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-role-prompts-"));
    mkdirSync(path.join(root, ".hima", "state"), { recursive: true });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exit 0", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "build the thing full" },
      root,
    );
    expect(status).toBe(0);
  });

  it('additionalContext still contains the one-line "[HIMA role:planner]" fallback', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "build the thing full" },
      root,
    );
    expect(stdout).toContain("[HIMA role:planner]");
  });

  it("additionalContext ALSO contains the richer bundled planner-variant prompt text", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "build the thing full" },
      root,
    );
    expect(stdout).toContain(RICH_PLANNER_MARKER);
  });
});
