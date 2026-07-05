/**
 * e2e-opencode.test.ts — SPAWN proof for R-050 (OpenCode CLI dispatch wiring).
 *
 * Before this wiring, translateOpenCode()/OPENCODE_MAP/dispatch.ts were fully
 * built + unit-tested (25 passing tests) but packages/hima-cli/src/index.ts
 * contained zero occurrences of the string "opencode": the --format/--runtime
 * resolution only recognized codex/hermes, so `norm hook ... --format opencode`
 * silently fell back to "claude" — real dispatch to translateOpenCode() was
 * unreachable through the CLI.
 *
 * This suite proves `norm hook pre-tool-use --format opencode` on a skill-force
 * condition reaches the real OpenCode adapter (hard-block, exit 2), analogous
 * to e2e-adapters.test.ts Scenarios A/B for codex/hermes.
 *
 * Pre-condition: `pnpm --filter @norm/cli build` must have run before this suite.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard } from "@norm/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

const DISCOVERY_SKILL_ID = "corpus-technical-analysis-discovery";

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
// Scenario — opencode skill-force block: exit 2 via the real OpenCode adapter
// ---------------------------------------------------------------------------

describe("R-050 — pre-tool-use --format opencode reaches the real adapter", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-opencode-"));
    await createWard(root, { id: "opencode-e2e", entryPoint: "full", floor: "H" });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exit code 2 (hard-block via translateOpenCode's skill-force → block mapping)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "opencode"],
      { toolName: "Write", toolInput: {} },
      root,
    );
    expect(status).toBe(2);
  });

  it('stdout carries decision:"block" and references the discovery skill id', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "opencode"],
      { toolName: "Write", toolInput: {} },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
    expect(stdout).toContain(DISCOVERY_SKILL_ID);
  });

  it("--format claude (default) is unaffected — same skill-force block still fires", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: {} },
      root,
    );
    expect(status).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// --runtime flag now accepts "opencode" (for the `setup` subcommand parser)
// ---------------------------------------------------------------------------

describe("R-050 — `norm setup --runtime opencode` is accepted (does not crash / no unknown-flag error)", () => {
  it("exits successfully (falls back to auto-detect; opencode setup wiring is a separate scope)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "hima-e2e-opencode-setup-"));
    try {
      const result = spawnSync(
        "node",
        [DIST_INDEX, "setup", "--runtime", "opencode", "--root", root],
        { encoding: "utf8", timeout: 15_000 },
      );
      expect(result.status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
