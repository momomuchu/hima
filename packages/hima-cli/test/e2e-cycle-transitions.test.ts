/**
 * e2e-cycle-transitions.test.ts — SPAWN proof for the cycle-transition engine.
 *
 * Covers R-006, R-007, R-021, R-040, R-043, R-054 end-to-end by spawning the
 * built dist/index.js in a real tmp .hima root.
 *
 * Scenario flow (shared tmp root — sequential state):
 *   (a) user-prompt-submit "x ulw"   → ward created at discovery; exit 0.
 *   (b) pre-tool-use Write spec file → exit 2 (RESEARCH_FIRST gate blocks).
 *   (c) stage-advance discovery=done → exit 0; ward.verdicts sealed; openStage→analysis.
 *   (d) pre-tool-use Write spec file → exit 0 (research sealed, allowed).
 *   (e) stage-advance remaining stages through verify=done → ledger file appears.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite.
 */

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resumeWard } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

/** Spec-class path that triggers the RESEARCH_FIRST gate. */
const SPEC_FILE = "docs/specs/x.spec.md";

// ---------------------------------------------------------------------------
// Shared tmp root (state flows sequentially across scenarios)
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-cycle-e2e-"));
  // Ensure the .hima/state directory hierarchy exists so the ward write is atomic.
  mkdirSync(path.join(root, ".hima", "state"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: spawn the CLI synchronously
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown> = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", root], {
    input: JSON.stringify(stdinPayload),
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
// (a) user-prompt-submit "x ulw" — creates a ward at discovery
// ---------------------------------------------------------------------------

describe("(a) user-prompt-submit — ward bootstrap", () => {
  it("exits 0", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "x ulw" },
    );
    expect(status).toBe(0);
  });

  it("emits a [HIMA] creation canary in additionalContext", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "x ulw" },
    );
    expect(stdout).toMatch(/\[HIMA\]/);
    expect(stdout).toMatch(/additionalContext|hookSpecificOutput/);
  });

  it("ward.json persisted with entryPoint=full and openStage=discovery", async () => {
    // Run one more time to ensure ward is created (idempotent: resumeWard returns existing)
    spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "x ulw" },
    );
    const ward = await resumeWard(root);
    expect(ward).not.toBeNull();
    expect(ward?.entryPoint).toBe("full");
    expect(ward?.openStage).toBe("discovery");
  });
});

// ---------------------------------------------------------------------------
// (b) pre-tool-use Write to spec file — RESEARCH_FIRST blocks
// ---------------------------------------------------------------------------

describe("(b) pre-tool-use Write to spec file — RESEARCH_FIRST", () => {
  it("exits 2 (block) when discovery is not yet sealed", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: SPEC_FILE } },
    );
    expect(status).toBe(2);
  });

  it('stdout contains "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: SPEC_FILE } },
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason mentions RESEARCH_FIRST or discovery", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: SPEC_FILE } },
    );
    // The reason must reference the violated gate (discovery research requirement)
    expect(stdout).toMatch(/RESEARCH_FIRST|discovery/i);
  });
});

// ---------------------------------------------------------------------------
// (c) stage-advance discovery=done — seals discovery, advances to analysis
// ---------------------------------------------------------------------------

describe("(c) stage-advance --stage discovery --status done", () => {
  it("exits 0", () => {
    const { status } = spawnCli([
      "hook",
      "stage-advance",
      "--stage",
      "discovery",
      "--status",
      "done",
    ]);
    expect(status).toBe(0);
  });

  it("emits a POST-ACT [HIMA] stage-advance canary in stdout", () => {
    const { stdout } = spawnCli([
      "hook",
      "stage-advance",
      "--stage",
      "discovery",
      "--status",
      "done",
    ]);
    // After advancing, the canary references the sealed stage and new openStage.
    expect(stdout).toMatch(/\[HIMA\].*stage-advance/);
  });

  it("emits a R-021 stage-entry canary for the new openStage", () => {
    const { stdout } = spawnCli([
      "hook",
      "stage-advance",
      "--stage",
      "discovery",
      "--status",
      "done",
    ]);
    // Stage-entry canary: "[HIMA] <entry>:<newStage> — floor:..."
    expect(stdout).toMatch(/\[HIMA\].*analysis/);
  });

  it("ward.verdicts has discovery=done and openStage is analysis", async () => {
    const ward = await resumeWard(root);
    expect(ward).not.toBeNull();
    const discoveryVerdict = ward?.verdicts.find((v) => v.stage === "discovery");
    expect(discoveryVerdict).toBeDefined();
    expect(discoveryVerdict?.status).toBe("done");
    expect(ward?.openStage).toBe("analysis");
  });
});

// ---------------------------------------------------------------------------
// (d) pre-tool-use Write to spec file after discovery sealed — now allowed
// ---------------------------------------------------------------------------

describe("(d) pre-tool-use Write to spec file — allowed after discovery sealed", () => {
  it("exits 0 after research gate is cleared", () => {
    // Use the same spec file path — it's a new file (doesn't exist on disk)
    // so BEH_READ_BEFORE_WRITE's new-file allowance applies.
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: SPEC_FILE } },
    );
    expect(status).toBe(0);
  });

  it('stdout does NOT contain "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: SPEC_FILE } },
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// (e) stage-advance through remaining stages → ledger file appears
// ---------------------------------------------------------------------------

describe("(e) stage-advance through to verify=done → ledger archived", () => {
  const stages = ["analysis", "spec", "design", "impl", "test", "verify"] as const;

  it("advances each remaining stage to done (exit 0 each)", () => {
    for (const stage of stages) {
      const { status } = spawnCli([
        "hook",
        "stage-advance",
        "--stage",
        stage,
        "--status",
        "done",
      ]);
      expect(status).toBe(0);
    }
  });

  it("ledger directory contains at least one .jsonl file after verify done", () => {
    const ledgerDir = path.join(root, ".hima", "state", "ledger");
    let files: string[] = [];
    try {
      files = readdirSync(ledgerDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      files = [];
    }
    expect(files.length).toBeGreaterThan(0);
  });

  it("ward openStage is maintenance after sealing verify", async () => {
    const ward = await resumeWard(root);
    expect(ward?.openStage).toBe("maintenance");
  });

  it("ward.verdicts contains a verify entry with status done", async () => {
    const ward = await resumeWard(root);
    const verifyVerdict = ward?.verdicts.find((v) => v.stage === "verify");
    expect(verifyVerdict).toBeDefined();
    expect(verifyVerdict?.status).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// R-054: subagent-stop — observe-only, no block
// ---------------------------------------------------------------------------

describe("R-054: subagent-stop — observe-only trace emission", () => {
  it("exits 0 (no block)", () => {
    const { status } = spawnCli(
      ["hook", "subagent-stop", "--format", "claude"],
      { sessionId: "test-session" },
    );
    expect(status).toBe(0);
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "subagent-stop", "--format", "claude"],
      { sessionId: "test-session" },
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// R-040: second user-prompt-submit on existing ward → resume canary
// ---------------------------------------------------------------------------

describe("R-040: second user-prompt-submit emits resume canary", () => {
  it("exits 0", () => {
    // The ward already exists; resumeWard returns the existing one.
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "continue ulw" },
    );
    expect(status).toBe(0);
  });

  it("resume canary contains 'resuming' keyword", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "continue ulw" },
    );
    // R-040: the resume path emits "[HIMA] <entry>:resuming ..."
    expect(stdout).toMatch(/resuming/);
  });
});
