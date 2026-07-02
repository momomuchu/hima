/**
 * e2e-next-attack-verdicts.test.ts — SPAWN proof for R-039 (verdict-driven
 * next-attack proposal at Stop).
 *
 * Before this wiring, router.ts's Stop handler called
 * `buildNextAttackContext(ward.openStage)` with no verdicts argument, so the
 * function always took the "sealedStages.length === 0" branch — a generic
 * "propose ranked next attacks" line regardless of what had actually shipped.
 *
 * This suite proves that `ward.verdicts` now flows into buildNextAttackContext
 * at the Stop call site: after sealing "discovery" via advanceStage, a clean
 * DONE_VERIFIED stop at M+ emits the STAGE-SPECIFIC ranked next attack
 * ("open analysis (map the domain)") instead of the generic fallback line.
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
// Scenario — sealed discovery verdict drives a stage-specific next attack
// ---------------------------------------------------------------------------

describe("R-039 — Stop emits a verdict-driven ranked next attack (not the generic fallback)", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-next-attack-"));
    await createWard(root, { id: "next-attack-e2e", entryPoint: "full", floor: "H" });
    // Seals "discovery" (the ward's initial openStage) with done-verified and
    // advances openStage to "spec" — mirrors e2e-stop-gate.test.ts Scenario B.
    await advanceStage(root, "spec", "done-verified");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exit 0 (clean allow — BEH-023 sees the done-verified evidence)", () => {
    const { status } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "next-attack-s1", prompt: "All done. DONE_VERIFIED." },
      root,
    );
    expect(status).toBe(0);
  });

  it('additionalContext contains the stage-specific next attack ("sealed: discovery → next attack: open analysis")', () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "next-attack-s2", prompt: "Task finished. DONE_VERIFIED." },
      root,
    );
    expect(stdout).toContain("sealed: discovery");
    expect(stdout).toContain("next attack: open analysis (map the domain)");
  });

  it('additionalContext does NOT contain the generic pre-R-039 fallback line', () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "next-attack-s3", prompt: "Task finished. DONE_VERIFIED." },
      root,
    );
    // The old generic form named the CURRENT openStage ("spec") as "sealed",
    // which is factually wrong (spec is open, not sealed) — proves the fix
    // replaced it rather than merely appending to it.
    expect(stdout).not.toContain("stage spec sealed — propose ranked next attacks");
  });
});
