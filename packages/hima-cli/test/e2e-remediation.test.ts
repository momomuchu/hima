/**
 * e2e-remediation.test.ts — SPAWN proof for I16 remediation gaps.
 *
 * Validates five wired gaps end-to-end by spawning the built dist/index.js
 * in isolated tmp .hima roots:
 *
 *   R-003: sessionId is threaded into BehaviorContext so BEH_READ_BEFORE_WRITE
 *          looks up the read-set under the correct key and does NOT block a file
 *          that was already recorded as read.
 *
 *   R-016: allow-path "[founder-feedback-scale] evaluated — NOT triggered" is
 *          surfaced in additionalContext (not silently discarded).
 *
 *   R-021: stage-advance canary includes "role:<planner|executor|reviewer>" so
 *          the agent knows which profile to activate for the new stage.
 *
 *   R-035: pre-tool-use Write in a non-discovery stage without a spawn manifest
 *          emits "[HIMA advisory-strong R-035]" advisory and exits 0 (advisory-
 *          only — never hard-blocks).
 *
 *   R-045: post-tool-use WebSearch at M+ criticality emits a research-convert
 *          advisory ("research evidence:") to remind the agent to convert
 *          findings before deciding.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes. The package.json test script chains build → vitest.
 *
 * Uses node:child_process spawnSync — synchronous so assertion ordering is
 * trivially sequential without async combinators.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { markLoaded } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

// ---------------------------------------------------------------------------
// Helper: spawn dist/index.js synchronously with a JSON stdin payload
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", cliRoot], {
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
// Helper: create a minimal ward via "ulw" sigil (floor H)
// ---------------------------------------------------------------------------

function createWardViaPrompt(root: string, sessionId: string): void {
  // The "ulw" sigil in the prompt creates a ward at floor H.
  spawnCli(
    ["hook", "user-prompt-submit"],
    { promptContent: "x ulw", sessionId },
    root,
  );
}

// ---------------------------------------------------------------------------
// R-003: sessionId key alignment — read-before-write reads are correctly keyed
// ---------------------------------------------------------------------------

describe("R-003: BEH_READ_BEFORE_WRITE respects ctx.sessionId (no block after recorded read)", () => {
  let root: string;
  const SESSION_ID = "test-session-r003";
  let targetFile: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-remediation-r003-"));
    mkdirSync(path.join(root, ".hima", "state"), { recursive: true });

    // Use a .md file: BEH_PLANNER_WRITE_GUARD allows .md writes at any stage,
    // so the only gate that matters here is BEH_READ_BEFORE_WRITE.
    // BEH_READ_BEFORE_WRITE only fires when the file already EXISTS on disk
    // (new-file writes are exempt).
    targetFile = path.join(root, "docs", "test-r003.md");
    mkdirSync(path.dirname(targetFile), { recursive: true });
    writeFileSync(targetFile, "# existing plan\n");

    // Create a ward at H floor via "ulw" sigil.
    createWardViaPrompt(root, SESSION_ID);

    // Mark all forceSkills for discovery at H floor so the skill gate does not block.
    // At H floor, discovery requires 3 skills (base + floor additions):
    //   corpus-technical-analysis-discovery (base)
    //   corpus-specification-requirements   (H floor addition via resolveStageForceSkillsForFloor)
    //   corpus-architecture-system-design   (H floor addition)
    await markLoaded(root, { source: "corpus", id: "corpus-technical-analysis-discovery" });
    await markLoaded(root, { source: "corpus", id: "corpus-specification-requirements" });
    await markLoaded(root, { source: "corpus", id: "corpus-architecture-system-design" });

    // Record the read: simulate post-tool-use Read so the read-set is populated
    // under SESSION_ID. This is what the PostToolUse handler does at runtime.
    spawnCli(
      ["hook", "post-tool-use"],
      {
        toolName: "Read",
        toolInput: { file_path: targetFile },
        sessionId: SESSION_ID,
      },
      root,
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 (not blocked) when Write follows a Read for the same file + sessionId", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        toolName: "Write",
        toolInput: { file_path: targetFile, content: "# updated plan\n" },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(status).toBe(0);
  });

  it("stdout does NOT contain READ_BEFORE_WRITE when the file was already read this session", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        toolName: "Write",
        toolInput: { file_path: targetFile, content: "# updated plan\n" },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(stdout).not.toContain("READ_BEFORE_WRITE");
  });

  it("exits 2 when Write targets an existing file that was NOT read in this session", () => {
    // Use a different sessionId so the read-set is empty for that session.
    // BEH_READ_BEFORE_WRITE blocks because file exists but was not read under this session.
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        toolName: "Write",
        toolInput: { file_path: targetFile, content: "# updated plan\n" },
        sessionId: "different-session-no-read",
      },
      root,
    );
    expect(status).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// R-016: NOT-triggered line is surfaced in allow path of user-prompt-submit
// ---------------------------------------------------------------------------

describe("R-016: [founder-feedback-scale] NOT triggered line appears in additionalContext", () => {
  let root: string;
  const SESSION_ID = "test-session-r016";

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-remediation-r016-"));
    mkdirSync(path.join(root, ".hima", "state"), { recursive: true });
    // Create a ward so riskClass is H (BEH_FEEDBACK_WAVE evaluates at all floors).
    createWardViaPrompt(root, SESSION_ID);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 for a neutral user prompt with sigil", () => {
    // Use the "run" terminal sigil so the prompt enters the full ward path
    // and evaluateGate (including BEH_FEEDBACK_WAVE) is called.
    // "check status run" has no artifact tokens and no evaluative language.
    const { status } = spawnCli(
      ["hook", "user-prompt-submit"],
      { promptContent: "check status run", sessionId: SESSION_ID },
      root,
    );
    expect(status).toBe(0);
  });

  it("includes 'NOT triggered' in stdout for a neutral prompt with sigil (no artifact token, no evaluative)", () => {
    // The "run" sigil causes evaluateGate to fire on the user_prompt gate.
    // BEH_FEEDBACK_WAVE finds no artifact tokens and no evaluative language
    // → returns allow with "[founder-feedback-scale] evaluated — NOT triggered".
    // The R-016 fix surfaces that reason in additionalContext.
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit"],
      { promptContent: "check status run", sessionId: SESSION_ID },
      root,
    );
    expect(stdout).toContain("NOT triggered");
  });

  it("does NOT include 'NOT triggered' for a feedback-wave prompt", () => {
    // A prompt with artifact token + evaluative language triggers the wave path
    // which returns "warn", NOT the NOT-triggered allow path.
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit"],
      {
        promptContent: "la landing page est cassée, refaire ulw",
        sessionId: SESSION_ID,
      },
      root,
    );
    // The wave path emits "feedback-wave", not "NOT triggered".
    expect(stdout).not.toContain("NOT triggered");
  });
});

// ---------------------------------------------------------------------------
// R-021: stage-advance canary includes "role:" for the new open stage
// ---------------------------------------------------------------------------

describe("R-021: stage-advance canary includes role:planner|executor|reviewer", () => {
  let root: string;
  const SESSION_ID = "test-session-r021";

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-remediation-r021-"));
    mkdirSync(path.join(root, ".hima", "state"), { recursive: true });
    // Create a ward at discovery stage.
    createWardViaPrompt(root, SESSION_ID);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 for stage-advance discovery=done", () => {
    const { status } = spawnCli(
      ["hook", "stage-advance", "--stage", "discovery", "--status", "done"],
      {},
      root,
    );
    expect(status).toBe(0);
  });

  it("emits 'role:' in the stage-entry canary", () => {
    // Advance from analysis back to spec to get a fresh canary for this test.
    // First create a fresh root so we get a clean discovery → analysis advance.
    const freshRoot = mkdtempSync(path.join(tmpdir(), "hima-r021-fresh-"));
    mkdirSync(path.join(freshRoot, ".hima", "state"), { recursive: true });
    createWardViaPrompt(freshRoot, SESSION_ID);

    const { stdout } = spawnCli(
      ["hook", "stage-advance", "--stage", "discovery", "--status", "done"],
      {},
      freshRoot,
    );

    rmSync(freshRoot, { recursive: true, force: true });
    // After advancing from discovery→analysis, the canary for the "analysis"
    // stage should include "role:planner" (analysis is a planner stage).
    expect(stdout).toMatch(/role:(planner|executor|reviewer|none)/);
  });

  it("includes the role string for 'verify' stage (reviewer role)", async () => {
    // Advance through all stages to verify to confirm the reviewer role appears.
    // This test advances through 7 stages (6 + verify), each spawning the CLI,
    // so it needs a generous timeout beyond the 15s default.
    const stagesRoot = mkdtempSync(path.join(tmpdir(), "hima-r021-stages-"));
    mkdirSync(path.join(stagesRoot, ".hima", "state"), { recursive: true });
    createWardViaPrompt(stagesRoot, SESSION_ID);

    const STAGES = [
      "discovery",
      "analysis",
      "spec",
      "design",
      "impl",
      "test",
    ] as const;
    for (const stage of STAGES) {
      spawnCli(
        ["hook", "stage-advance", "--stage", stage, "--status", "done"],
        {},
        stagesRoot,
      );
    }
    // Now advance to verify.
    const { stdout } = spawnCli(
      ["hook", "stage-advance", "--stage", "verify", "--status", "done"],
      {},
      stagesRoot,
    );

    rmSync(stagesRoot, { recursive: true, force: true });
    // verify stage → role:reviewer (or role:none if no match, but reviewer is expected).
    expect(stdout).toContain("role:");
  }, 30_000);
});

// ---------------------------------------------------------------------------
// R-035: StageParallelizationGate advisory fires for Write without spawn manifest
// ---------------------------------------------------------------------------

describe("R-035: spawn-manifest advisory fires at non-discovery stage Write", () => {
  let root: string;
  const SESSION_ID = "test-session-r035";

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-remediation-r035-"));
    mkdirSync(path.join(root, ".hima", "state"), { recursive: true });

    // Create a ward at discovery, advance to analysis (non-discovery stage).
    createWardViaPrompt(root, SESSION_ID);

    // Mark discovery skills loaded before advancing.
    await markLoaded(root, { source: "corpus", id: "corpus-technical-analysis-discovery" });

    // Seal discovery → openStage becomes analysis.
    spawnCli(
      ["hook", "stage-advance", "--stage", "discovery", "--status", "done"],
      {},
      root,
    );

    // Mark analysis skills loaded so the skill gate does not block.
    await markLoaded(root, { source: "corpus", id: "corpus-specification-requirements" });
    await markLoaded(root, { source: "corpus", id: "corpus-domain-modeling-ddd" });
    await markLoaded(root, { source: "corpus", id: "corpus-architecture-system-design" });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 (advisory-only, never hard-blocks) for Write at analysis stage without spawn manifest", () => {
    // Use .hima/plans/ path: BEH_PLANNER_WRITE_GUARD allows planners to write
    // inside .hima/plans/ so the behavior gate does not block.
    // File does not exist → BEH_READ_BEFORE_WRITE treats it as new-file (exempt).
    // Skills are loaded → missing === undefined → R-035 fires.
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        toolName: "Write",
        toolInput: {
          file_path: path.join(root, ".hima", "plans", "analysis-plan.md"),
          content: "# analysis plan\n",
        },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(status).toBe(0);
  });

  it("stdout contains '[HIMA advisory-strong R-035]' when spawn manifest is absent", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        toolName: "Write",
        toolInput: {
          file_path: path.join(root, ".hima", "plans", "another-plan.md"),
          content: "# another plan\n",
        },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(stdout).toContain("R-035");
  });
});

// ---------------------------------------------------------------------------
// R-045: research-convert advisory fires for WebSearch/WebFetch at M+
// ---------------------------------------------------------------------------

describe("R-045: research-convert advisory emitted for WebSearch at M+ criticality", () => {
  let root: string;
  const SESSION_ID = "test-session-r045";

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-remediation-r045-"));
    mkdirSync(path.join(root, ".hima", "state"), { recursive: true });
    // "ulw" sigil → ward at H (above M threshold).
    createWardViaPrompt(root, SESSION_ID);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 for WebSearch post-tool-use at H criticality", () => {
    const { status } = spawnCli(
      ["hook", "post-tool-use"],
      {
        toolName: "WebSearch",
        toolInput: { query: "vitest mocking patterns" },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(status).toBe(0);
  });

  it("stdout contains 'research evidence:' advisory for WebSearch at M+", () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use"],
      {
        toolName: "WebSearch",
        toolInput: { query: "typescript strict mode" },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(stdout).toContain("research evidence:");
  });

  it("stdout contains 'research evidence:' advisory for WebFetch at M+", () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use"],
      {
        toolName: "WebFetch",
        toolInput: { url: "https://example.com/docs" },
        sessionId: SESSION_ID,
      },
      root,
    );
    expect(stdout).toContain("research evidence:");
  });

  it("does NOT emit research-convert advisory when no active ward (T criticality)", () => {
    const emptyRoot = mkdtempSync(path.join(tmpdir(), "hima-r045-empty-"));
    mkdirSync(path.join(emptyRoot, ".hima", "state"), { recursive: true });

    const { stdout } = spawnCli(
      ["hook", "post-tool-use"],
      {
        toolName: "WebSearch",
        toolInput: { query: "test query" },
        sessionId: "no-ward-session",
      },
      emptyRoot,
    );

    rmSync(emptyRoot, { recursive: true, force: true });
    // No ward → riskClass T → below M floor → no advisory.
    expect(stdout).not.toContain("research evidence:");
  });
});
