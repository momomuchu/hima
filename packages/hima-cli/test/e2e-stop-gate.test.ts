/**
 * e2e-stop-gate.test.ts — SPAWN proof for the R-005 stop gate + BEH-023.
 *
 * Spawns the BUILT dist/index.js to validate the stop gate end-to-end:
 *
 *  Scenario A — stop with DONE_VERIFIED output + no ward evidence → exit 2 (block)
 *               The block reason must mention BEH-023 and evidence.
 *
 *  Scenario B — stop with DONE_VERIFIED output + ward has done-verified verdict → exit 0
 *               BEH-023 sees the evidence and allows.
 *
 *  Scenario C — stop with no completion claim → exit 0 (allow, nothing to scan)
 *
 *  Scenario D — stop via hermes runtime → exit 0 (deferred, canBlock=false)
 *               Even when verdict is "block", hermes stop does NOT exit 2.
 *
 *  Scenario E — pre-tool-use with --format codex on skill-force → exit 2 (codex fallback)
 *               dispatchTranslate("codex", skill-force-action) falls back to claude format
 *               which returns decision:"block", so exit 2.
 *
 * Pre-condition: `pnpm --filter @norm/cli build` must have run first.
 *
 * Runtime: node:child_process spawnSync (synchronous, sequential).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard, advanceStage, markLoaded } from "@norm/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

const DISCOVERY_SKILL_ID = "corpus-technical-analysis-discovery";

// ---------------------------------------------------------------------------
// Helper: spawn CLI with JSON stdin
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    [DIST_INDEX, ...args, "--root", cliRoot],
    {
      input: JSON.stringify(stdinPayload),
      encoding: "utf8",
      timeout: 15_000,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Scenario A — stop blocks when DONE_VERIFIED but no ward evidence
// ---------------------------------------------------------------------------

describe("Scenario A — stop gate: DONE_VERIFIED + no evidence → exit 2", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-a-"));
    // Create a ward at floor H with no verdicts (no done-verified evidence).
    await createWard(root, { id: "stop-e2e-a", entryPoint: "full", floor: "H" });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 2 (block)", () => {
    const { status } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-a", prompt: "All done. DONE_VERIFIED." },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-a", prompt: "All done. DONE_VERIFIED." },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason mentions BEH-023 and evidence", () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-a", prompt: "Task complete. DONE_VERIFIED." },
      root,
    );
    // BEH-023 injects its id and references done-verified evidence requirement.
    expect(stdout).toMatch(/BEH-023/);
    expect(stdout).toMatch(/done-verified|evidence/i);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — stop allows when DONE_VERIFIED + done-verified verdict exists
// ---------------------------------------------------------------------------

describe("Scenario B — stop gate: DONE_VERIFIED + done-verified verdict → exit 0", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-b-"));
    // Create ward then record a done-verified verdict by advancing stage.
    await createWard(root, { id: "stop-e2e-b", entryPoint: "full", floor: "H" });
    // advanceStage closes the current openStage ("discovery") with done-verified.
    await advanceStage(root, "spec", "done-verified");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 0 (allow)", () => {
    const { status } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-b", prompt: "All done. DONE_VERIFIED." },
      root,
    );
    expect(status).toBe(0);
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-b", prompt: "Task finished. DONE_VERIFIED." },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// Scenario C — stop with no completion claim → exit 0 (allow)
// ---------------------------------------------------------------------------

describe("Scenario C — stop gate: no completion claim → exit 0", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-c-"));
    await createWard(root, { id: "stop-e2e-c", entryPoint: "full", floor: "H" });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 0 when output has no completion lexeme", () => {
    const { status } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-c", prompt: "Still working on the analysis phase." },
      root,
    );
    expect(status).toBe(0);
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "claude"],
      { session_id: "s-c", prompt: "Reviewing the spec now." },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// Scenario D — stop via hermes: deferred enforcement → exit 0 even on block
// ---------------------------------------------------------------------------

describe("Scenario D — stop gate: hermes runtime → deferred (exit 0 always)", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-d-"));
    // Ward at H with no verdicts — same state that would block on claude.
    await createWard(root, { id: "stop-e2e-d", entryPoint: "full", floor: "H" });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 0 (hermes stop is deferred, not blocking)", () => {
    const { status } = spawnCli(
      ["hook", "stop", "--format", "hermes"],
      { session_id: "s-d", prompt: "DONE_VERIFIED — all stages passed." },
      root,
    );
    // hermes stop: canBlock=false → exit 0 regardless of verdict.
    expect(status).toBe(0);
  });

  it("stdout does NOT contain block decision for hermes", () => {
    const { stdout } = spawnCli(
      ["hook", "stop", "--format", "hermes"],
      { session_id: "s-d", prompt: "DONE_VERIFIED." },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// Scenario E — pre-tool-use with codex runtime on skill-force → exit 2
// ---------------------------------------------------------------------------

describe("Scenario E — dispatch: pre-tool-use --format codex + skill-force → exit 2", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-e-"));
    // Ward at discovery with empty register → skill-force will block.
    await createWard(root, { id: "stop-e2e-e", entryPoint: "full", floor: "H" });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 2 (codex skill-force block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "codex"],
      { tool_name: "Write", tool_input: { path: "src/spec.md", content: "x" } },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains block decision for codex dispatch", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "codex"],
      { tool_name: "Write", tool_input: { path: "src/spec.md", content: "x" } },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("stdout references the discovery skill id", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "codex"],
      { tool_name: "Write", tool_input: { path: "src/plan.md", content: "y" } },
      root,
    );
    expect(stdout).toContain(DISCOVERY_SKILL_ID);
  });

  it("pre-tool-use --format codex allows after skill markLoaded", async () => {
    const root2 = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-e2-"));
    try {
      // Use floor M so only 1 skill is required (no R-017 floor-scaling extras at M).
      await createWard(root2, { id: "stop-e2e-e2", entryPoint: "full", floor: "M" });
      await markLoaded(root2, { source: "corpus", id: DISCOVERY_SKILL_ID });

      // Use a .md path so the planner write-guard (discovery = planner stage) allows;
      // skill-force also passes since the skill is loaded → exit 0.
      const { status } = spawnCli(
        ["hook", "pre-tool-use", "--format", "codex"],
        { tool_name: "Write", tool_input: { path: "src/plan.md", content: "z" } },
        root2,
      );
      expect(status).toBe(0);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario F — safety: stop with empty stdin → exit 0 (tolerant)
// ---------------------------------------------------------------------------

describe("Scenario F — stop gate: empty/no ward → exit 0 (safety)", () => {
  it("stop with no ward.json → exit 0 (no pipeline active)", () => {
    const emptyRoot = mkdtempSync(path.join(tmpdir(), "hima-stop-e2e-f-"));
    try {
      const { status } = spawnCli(
        ["hook", "stop", "--format", "claude"],
        { session_id: "s-f", prompt: "DONE_VERIFIED" },
        emptyRoot,
      );
      // No ward → riskClass defaults to T → BEH-023 warns (not blocks) at T.
      // At T, warn is returned by BEH-023, which means exit 0.
      expect(status).toBe(0);
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
