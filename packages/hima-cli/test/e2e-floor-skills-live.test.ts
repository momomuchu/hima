/**
 * e2e-floor-skills-live.test.ts — SPAWN proof confirming R-017's floor-scaling
 * resolver is generic and already reaches the "analysis" and "test" DEV_CYCLE
 * stages through the LIVE pre_tool path (not just the orphaned floor-skills.ts
 * module flagged by V3-CERTIFICATION.md as having only 5-of-8 stage entries).
 *
 * router.ts's handlePreToolUse calls resolveStageForceSkillsForFloor(base,
 * ward.openStage, ward.floor) generically for whatever stage is open — the
 * function itself (packages/hima-core/src/config.ts) already carries H/C
 * extras for all 8 DEV_CYCLE stages including analysis/test/maintenance
 * (STAGE_FLOOR_EXTRAS). This suite drives the router end-to-end at floor H
 * for the analysis and test stages and asserts the floor-scaled extra skill
 * appears in the live block reason — proving no additional wiring was needed
 * for those two stages (only floor-skills.ts, a fully unreferenced duplicate
 * module, was incomplete).
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard, advanceStage } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

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
// Scenario A — "analysis" stage at floor H gets the H-only floor extra
// (corpus-architecture-system-design is NOT in DEV_CYCLE.analysis.forceSkills;
// it only appears via STAGE_FLOOR_EXTRAS.analysis.H).
// ---------------------------------------------------------------------------

describe("R-017 (live) — analysis stage floor-H uplift reaches the pre_tool block reason", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-floor-analysis-"));
    await createWard(root, { id: "floor-analysis-e2e", entryPoint: "full", floor: "H" });
    await advanceStage(root, "analysis", "done"); // seals discovery, opens analysis
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exit 2 (block) with the floor-H-only extra skill listed in the reason", () => {
    // "analysis" is a PLANNER_STAGES member — BEH_PLANNER_WRITE_GUARD only
    // allows .md writes there, so a .md target is used to reach the
    // skill-force check under test (not the planner write-guard block).
    const { status, stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "docs/plans/analysis-notes.md" } },
      root,
    );
    expect(status).toBe(2);
    expect(stdout).toContain("corpus-architecture-system-design");
  });
});

// ---------------------------------------------------------------------------
// Scenario B — "test" stage at floor H gets the H-only floor extra
// (corpus-code-quality-maintainability is NOT in DEV_CYCLE.test.forceSkills;
// it only appears via STAGE_FLOOR_EXTRAS.test.H).
// ---------------------------------------------------------------------------

describe("R-017 (live) — test stage floor-H uplift reaches the pre_tool block reason", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-floor-test-"));
    await createWard(root, { id: "floor-test-e2e", entryPoint: "full", floor: "H" });
    await advanceStage(root, "analysis", "done");
    await advanceStage(root, "spec", "done");
    await advanceStage(root, "design", "done");
    await advanceStage(root, "impl", "done");
    await advanceStage(root, "test", "done"); // opens "test" stage
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exit 2 (block) with the floor-H-only extra skill listed in the reason", () => {
    const { status, stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "test/foo.test.ts" } },
      root,
    );
    expect(status).toBe(2);
    expect(stdout).toContain("corpus-code-quality-maintainability");
  });
});
