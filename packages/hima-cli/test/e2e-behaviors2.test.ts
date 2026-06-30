/**
 * e2e-behaviors2.test.ts — SPAWN proof for I14b behavior integrations.
 *
 * Validates three advisory behavior paths end-to-end by spawning the BUILT
 * dist/index.js in real tmp .hima roots:
 *
 *   (a) user-prompt-submit "la landing est cassée, refais tout ulw"
 *       → exit 0 + additionalContext contains "feedback-wave" (BEH_FEEDBACK_WAVE)
 *         + a waves.log line written (R-037 appendWaveLog).
 *
 *   (b) user-prompt-submit "build x run"
 *       → exit 0 + additionalContext contains "research sub-pass" (R-041)
 *         AND "[HIMA spawn]" role-team advisory (R-035).
 *
 *   (c) post-tool-use with agentOutput "absolutely, great idea" at an M ward
 *       → exit 0 + additionalContext contains "ANTI-SYCOPHANCY" advisory (R-022).
 *
 * All paths are advisory only — they NEVER exit 2.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes. The test runner chains build → vitest in package.json.
 *
 * Uses node:child_process spawnSync — synchronous so assertion ordering is
 * trivially sequential without async combinators.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createWard } from "@hima/core";

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
    timeout: 15_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// (a) feedback-wave detect + waves.log emission (R-016 + R-037)
// ---------------------------------------------------------------------------

describe("(a) user-prompt-submit: feedback-wave detected → advisory + waves.log written", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-behaviors2-a-"));
    // No pre-existing ward: "ulw" sigil will create one with floor H.
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const payload = {
    sessionId: "beh2-test-a",
    promptContent: "la landing est cassée, refais tout ulw",
  };

  it("exit 0 (advisory — never blocks)", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      payload,
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "feedback-wave" in additionalContext (BEH_FEEDBACK_WAVE warn)', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      payload,
      root,
    );
    // BEH-FEEDBACK-WAVE emits a reason containing "BEH-FEEDBACK-WAVE"
    // which is injected as "[HIMA advisory] [BEH-FEEDBACK-WAVE] ..."
    expect(stdout.toLowerCase()).toContain("feedback-wave");
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      payload,
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  it("waves.log file is written after feedback-wave trigger (R-037)", () => {
    // Run the hook once to trigger appendWaveLog.
    spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      payload,
      root,
    );
    // waves.log path: <root>/.hima/state/waves.log
    const logPath = path.join(root, ".hima", "state", "waves.log");
    expect(existsSync(logPath)).toBe(true);
  });

  it("waves.log contains a JSON line with wave metadata", () => {
    spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      payload,
      root,
    );
    const logPath = path.join(root, ".hima", "state", "waves.log");
    if (!existsSync(logPath)) {
      // Guard: fail with a helpful message rather than an ENOENT crash.
      expect(existsSync(logPath)).toBe(true);
      return;
    }
    const content = readFileSync(logPath, "utf8").trim();
    // Each line is a valid JSON object with at least wave_id and ts.
    const lines = content.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const entry = JSON.parse(lines[lines.length - 1]!);
    expect(typeof entry["wave_id"]).toBe("string");
    expect(typeof entry["ts"]).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// (b) run entry: research sub-pass + spawn assignment advisory (R-041 + R-035)
//
// Research sub-pass and spawn plan fire only on the CREATE path (existing === null).
// Each it() that checks those must use a fresh root so the ward is always created
// rather than resumed. We use beforeEach/afterEach to guarantee isolation.
// ---------------------------------------------------------------------------

describe("(b) user-prompt-submit: run sigil → research sub-pass + spawn role-team injected", () => {
  // Fresh root per test — research/spawn fire on CREATE only.
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-behaviors2-b-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function freshPayload(): Record<string, unknown> {
    // Use a unique sessionId per call to prevent any cross-call state bleed.
    return {
      sessionId: `beh2-test-b-${Date.now()}`,
      promptContent: "build x run",
    };
  }

  it("exit 0 (advisory — never blocks)", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      freshPayload(),
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "research sub-pass" (R-041 runResearchSubpassContext)', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      freshPayload(),
      root,
    );
    expect(stdout).toContain("research sub-pass");
  });

  it('stdout contains "[HIMA spawn]" role-team advisory (R-035 buildSpawnAssignmentContext)', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      freshPayload(),
      root,
    );
    expect(stdout).toContain("[HIMA spawn]");
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      freshPayload(),
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// (c) post-tool-use: anti-sycophancy advisory at M ward (R-022)
// ---------------------------------------------------------------------------

describe("(c) post-tool-use: sycophantic agent output at M ward → anti-sycophancy advisory", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-behaviors2-c-"));
    // Create an M-floor ward so BEH_ANTI_SYCOPHANCY's WARN_FLOOR (M) is met.
    await createWard(root, {
      id: "beh2-ward-c",
      entryPoint: "run",
      floor: "M",
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // promptContent carries the "agent output" text for anti-sycophancy scanning.
  // In a real hook, the tool result is carried via a separate field; for our
  // StdinPayload shape, promptContent is the generic text injection channel.
  const payload = {
    sessionId: "beh2-test-c",
    toolName: "Bash",
    toolInput: { command: "echo test" },
    promptContent: "absolutely, great idea, let's proceed with that approach",
  };

  it("exit 0 (advisory — never blocks)", () => {
    const { status } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      payload,
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "ANTI-SYCOPHANCY" advisory (BEH_ANTI_SYCOPHANCY warn)', () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      payload,
      root,
    );
    // BEH-ANTI-SYCOPHANCY emits "[BEH-ANTI-SYCOPHANCY] agreement without..."
    // injected as "[HIMA advisory] [BEH-ANTI-SYCOPHANCY] ..."
    expect(stdout.toUpperCase()).toContain("ANTI-SYCOPHANCY");
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      payload,
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  it("stdout contains hookSpecificOutput additionalContext shape", () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      payload,
      root,
    );
    expect(stdout).toMatch(/additionalContext|hookSpecificOutput/);
  });
});
