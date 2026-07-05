/**
 * e2e-config-override.test.ts — SPAWN proof that per-project config.json
 * changes which skill the pre-tool-use gate hard-forces.
 *
 * Two scenarios run against the built dist/index.js:
 *
 *   Scenario A — WITH config:
 *     <tmp>/.hima/config.json = { stageSkills: { discovery: { force: [OVERRIDE_SKILL] } } }
 *     Ward at discovery → pre-tool-use Write → exit 2, reason contains OVERRIDE_SKILL,
 *     does NOT contain the default skill (corpus-technical-analysis-discovery).
 *
 *   Scenario B — WITHOUT config:
 *     No .hima/config.json in tmp root.
 *     Ward at discovery → pre-tool-use Write → exit 2, reason contains DEFAULT_SKILL.
 *
 * Pre-condition: `pnpm --filter @norm/cli build` must have run.
 */

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
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

/** Default discovery-stage forceSkill from DEV_CYCLE (schemas/src/cycle.ts). */
const DEFAULT_SKILL_ID = "corpus-technical-analysis-discovery";

/**
 * The override skill id written into config.json for Scenario A.
 * Intentionally different from the default so we can assert the override took effect.
 */
const OVERRIDE_SKILL_ID = "corpus-OVERRIDE-SKILL";

const WRITE_TOOL = "Write";

// ---------------------------------------------------------------------------
// Helper: spawn CLI synchronously
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  root: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", root], {
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
// Scenario A — WITH config override
// ---------------------------------------------------------------------------

describe("Scenario A — project config.json overrides discovery forceSkill", () => {
  let aRoot: string;

  beforeAll(async () => {
    aRoot = mkdtempSync(path.join(tmpdir(), "hima-e2e-cfg-override-a-"));

    // 1. Create the .hima/config.json with override
    const himaDir = path.join(aRoot, ".hima");
    mkdirSync(himaDir, { recursive: true });
    const config = {
      stageSkills: {
        discovery: {
          force: [{ source: "corpus", id: OVERRIDE_SKILL_ID }],
        },
      },
    };
    writeFileSync(path.join(himaDir, "config.json"), JSON.stringify(config));

    // 2. Create a ward at discovery (empty skill register)
    await createWard(aRoot, {
      id: "e2e-cfg-override-a",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => {
    rmSync(aRoot, { recursive: true, force: true });
  });

  it("exit 2 — blocked (override skill is required, not loaded)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      aRoot,
    );
    expect(status).toBe(2);
  });

  it('stdout contains "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      aRoot,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason names the OVERRIDE skill (not the default)", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      aRoot,
    );
    expect(stdout).toContain(OVERRIDE_SKILL_ID);
    expect(stdout).not.toContain(DEFAULT_SKILL_ID);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — WITHOUT config (default DEV_CYCLE behavior)
// ---------------------------------------------------------------------------

describe("Scenario B — no config.json → default DEV_CYCLE skill is forced", () => {
  let bRoot: string;

  beforeAll(async () => {
    bRoot = mkdtempSync(path.join(tmpdir(), "hima-e2e-cfg-override-b-"));

    // No config.json written — only create the ward
    await createWard(bRoot, {
      id: "e2e-cfg-override-b",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => {
    rmSync(bRoot, { recursive: true, force: true });
  });

  it("exit 2 — blocked (default skill is required, not loaded)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      bRoot,
    );
    expect(status).toBe(2);
  });

  it("block reason names the DEFAULT discovery skill", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      bRoot,
    );
    expect(stdout).toContain(DEFAULT_SKILL_ID);
  });

  it("default block reason does NOT mention the override skill id", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      bRoot,
    );
    expect(stdout).not.toContain(OVERRIDE_SKILL_ID);
  });
});
