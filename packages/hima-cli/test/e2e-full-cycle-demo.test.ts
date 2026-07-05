/**
 * e2e-full-cycle-demo.test.ts — R3: fully-scripted spawned-CLI demo of a whole 8-stage
 * hima dev cycle, driven only by the real `hima` binary (no manual verify sub-agent, no
 * direct @norm/core calls for the sealing itself — only read-only assertions afterward).
 *
 * Flow:
 *   1. `norm init --yes`                                 — scaffold .hima/config.json etc.
 *   2. `norm hook user-prompt-submit` with a "full" sigil — bootstraps a ward at "discovery"
 *      (per ward-store.ts's entry-point map: only "full"/"ulw" starts at discovery; "run" and
 *      "spec" sigils start mid-cycle at "spec" — intentionally NOT used here since R3 wants
 *      all 8 stages, starting at discovery).
 *   3. `norm hook stage-advance --stage <s> --status done-verified` for each of the 8
 *      DEV_CYCLE stage ids in order (discovery -> ... -> maintenance).
 *   4. Assert: the trace file names every stage as sealed with a descriptive `reason`
 *      (mechanical trace-level evidence), the ward reaches openStage="maintenance" with
 *      all 8 verdicts recorded as "done-verified", and the run closed to the ledger
 *      (archived) purely from CLI invocations — no separate reviewer/verifier process ran.
 *
 * GAP (reported, not hidden — do not fake a pass): the current `norm hook stage-advance`
 * CLI surface has no `--evidence` flag. `handleStageAdvance` (packages/hima-cli/src/router.ts)
 * calls `writeStageVerdict(root, stage, status)` with the `evidence` parameter omitted, which
 * defaults to `[]` (packages/hima-core/src/ward-transitions.ts). So `StageVerdict.evidence`
 * is always `[]` when sealed through this CLI path — the only real "evidence" a scripted run
 * can produce today is the descriptive `reason` string each StageAdvance trace event carries
 * (e.g. `stage-advance: "discovery" -> done-verified; openStage now "analysis"`). This test
 * asserts that trace-level evidence explicitly, and separately asserts (rather than hides)
 * that `ward.verdicts[].evidence` stays `[]` — a real gap for a future `--evidence` flag, not
 * a false-green pass. A second gap: sealing "verify" as done-verified is itself performed by
 * this same scripted actor calling stage-advance directly — there is no mechanical enforcement
 * via this CLI surface that a *different* (independent) agent produced the verify verdict;
 * norm-verdict's "never self-declared by the builder" rule is a skill-level/process convention,
 * not something `norm hook stage-advance` itself checks or blocks on.
 *
 * Pre-condition: `pnpm --filter @norm/cli build` (and its workspace deps) must have run.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resumeWard, readTrace } from "@norm/core";

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

/** The 8 DEV_CYCLE stage ids, in order (mirrors GENERIC_DEV_CYCLE / DEV_CYCLE). */
const ALL_STAGES = [
  "discovery",
  "analysis",
  "spec",
  "design",
  "impl",
  "test",
  "verify",
  "maintenance",
] as const;

const SESSION_ID = "full-cycle-demo-session";

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-full-cycle-demo-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown> | null = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", root], {
    input: stdinPayload === null ? undefined : JSON.stringify(stdinPayload),
    encoding: "utf8",
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// 1. norm init --yes
// ---------------------------------------------------------------------------

describe("(1) norm init --yes — scaffold the project", () => {
  it("exits 0", () => {
    const { status } = spawnCli(["init", "--yes"], null);
    expect(status).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. user-prompt-submit "demo run" — bootstraps a ward at discovery
// ---------------------------------------------------------------------------

describe("(2) norm hook user-prompt-submit — ward bootstrap", () => {
  it("exits 0 and creates a ward at openStage=discovery", async () => {
    const { status } = spawnCli(["hook", "user-prompt-submit", "--format", "claude"], {
      sessionId: SESSION_ID,
      promptContent: "demo full",
    });
    expect(status).toBe(0);

    const ward = await resumeWard(root);
    expect(ward).not.toBeNull();
    expect(ward?.openStage).toBe("discovery");
  });
});

// ---------------------------------------------------------------------------
// 3. stage-advance done-verified for all 8 stages, in order, via the real CLI only
// ---------------------------------------------------------------------------

describe("(3) norm hook stage-advance — seal all 8 stages as done-verified", () => {
  it("every stage-advance call exits 0", () => {
    for (const stage of ALL_STAGES) {
      const { status, stderr } = spawnCli(
        ["hook", "stage-advance", "--stage", stage, "--status", "done-verified"],
        { sessionId: SESSION_ID },
      );
      expect(status, `stage "${stage}" failed: ${stderr}`).toBe(0);
    }
  }, 60_000);

  it("ward reaches openStage=maintenance with all 8 stages sealed done-verified", async () => {
    const ward = await resumeWard(root);
    expect(ward).not.toBeNull();
    expect(ward?.openStage).toBe("maintenance");

    for (const stage of ALL_STAGES) {
      const verdict = ward?.verdicts.find((v) => v.stage === stage);
      expect(verdict, `no verdict recorded for stage "${stage}"`).toBeDefined();
      expect(verdict?.status).toBe("done-verified");
    }
  });

  it("the run closed to the ledger (verify seal archived it) — no manual verify agent ran", () => {
    const ledgerDir = path.join(root, ".hima", "state", "ledger");
    const files = readdirSync(ledgerDir).filter((f) => f.endsWith(".jsonl"));
    expect(files.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Trace-level evidence: every stage-advance names the sealed stage + verdict
// ---------------------------------------------------------------------------

describe("(4) trace shows every stage sealed with descriptive evidence", () => {
  it("the trace file contains a StageAdvance event per stage naming its done-verified seal", async () => {
    const events = await readTrace(root, SESSION_ID);
    const stageAdvanceEvents = events.filter((e) => e.hookEvent === "StageAdvance");

    for (const stage of ALL_STAGES) {
      const match = stageAdvanceEvents.find(
        (e) =>
          typeof e.reason === "string" &&
          e.reason.includes(`"${stage}"`) &&
          e.reason.includes("done-verified"),
      );
      expect(match, `no trace evidence found for stage "${stage}"`).toBeDefined();
    }

    // Reached a final sealed state: the last stage sealed is "maintenance", and its
    // openStage-after is itself (maintenance is terminal — see ward-transitions.ts).
    const maintenanceEvent = stageAdvanceEvents.find(
      (e) => typeof e.reason === "string" && e.reason.includes('"maintenance"'),
    );
    expect(maintenanceEvent?.reason).toContain('openStage now "maintenance"');
  });

  // GAP (documented, not hidden): StageVerdict.evidence itself is always `[]` when sealed
  // through `norm hook stage-advance` — there is no `--evidence` CLI flag today, so the only
  // mechanical evidence a scripted run produces is the trace `reason` string asserted above.
  it("GAP: ward.verdicts[].evidence is [] for every stage (no --evidence flag on stage-advance)", async () => {
    const ward = await resumeWard(root);
    for (const stage of ALL_STAGES) {
      const verdict = ward?.verdicts.find((v) => v.stage === stage);
      expect(verdict?.evidence).toEqual([]);
    }
  });
});
