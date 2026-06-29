/**
 * e2e-cli-spawn.test.ts — PRIMARY proof for @hima/cli (v3 walking skeleton).
 *
 * Spawns the BUILT dist/index.js (node packages/hima-cli/dist/index.js) in a
 * real tmp .hima root to validate the full hook invocation cycle end-to-end:
 *
 *   Scenario 1 — pre-tool-use BLOCKS when discovery skill not yet loaded.
 *   Scenario 2 — pre-tool-use ALLOWS after discovery skill is markLoaded.
 *   Scenario 3 — user-prompt-submit with "ulw" sigil → exit 0 + ward created.
 *   Scenario 4 — post-tool-use → exit 0 (graceful no-op).
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes. The test runner is responsible for the build step (see the
 * `test` script in package.json which chains build → vitest).
 *
 * Uses node:child_process spawnSync — synchronous so assertion ordering is
 * trivially sequential without async combinators.
 *
 * Discovery-stage forceSkill (from DEV_CYCLE): corpus-technical-analysis-discovery.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard, markLoaded, resumeWard } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Absolute path to the built CLI entry-point.
 * The e2e suite requires a prior `pnpm build` in the @hima/cli package.
 */
const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

/** The discovery-stage forceSkill id per DEV_CYCLE (schemas/src/cycle.ts). */
const DISCOVERY_SKILL_ID = "corpus-technical-analysis-discovery";

/**
 * Write tools that trigger skill-force blocking at pre-tool-use.
 * Per contract: Write | Edit | MultiEdit are the write-tool set.
 */
const WRITE_TOOL = "Write";

// ---------------------------------------------------------------------------
// Tmp root lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-cli-e2e-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: spawn dist/index.js synchronously with a JSON stdin payload
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown> = {},
  overrideRoot?: string,
): { status: number | null; stdout: string; stderr: string } {
  const cliRoot = overrideRoot ?? root;

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
// Scenario 1 — pre-tool-use BLOCKS (discovery skill not yet in register)
// ---------------------------------------------------------------------------

describe("Scenario 1 — pre-tool-use blocks when discovery skill is absent", () => {
  /**
   * Set up a fresh sub-root for this scenario so state does not bleed into
   * Scenario 2 (which starts from the same loaded-skill state).
   */
  let s1root: string;

  beforeAll(async () => {
    s1root = mkdtempSync(path.join(tmpdir(), "hima-cli-e2e-s1-"));
    // Create a ward at openStage "discovery" with an empty skill register.
    await createWard(s1root, {
      id: "e2e-scenario-1",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => {
    rmSync(s1root, { recursive: true, force: true });
  });

  it("exitStatus === 2 (block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      s1root,
    );
    expect(status).toBe(2);
  });

  it('stdout contains "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      s1root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("stdout references the discovery-stage skill id", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      s1root,
    );
    expect(stdout).toContain(DISCOVERY_SKILL_ID);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — pre-tool-use ALLOWS after markLoaded
// ---------------------------------------------------------------------------

describe("Scenario 2 — pre-tool-use allows after discovery skill is markLoaded", () => {
  let s2root: string;

  beforeAll(async () => {
    s2root = mkdtempSync(path.join(tmpdir(), "hima-cli-e2e-s2-"));
    // Ward at discovery, then immediately mark the skill as loaded.
    await createWard(s2root, {
      id: "e2e-scenario-2",
      entryPoint: "full",
      floor: "H",
    });
    await markLoaded(s2root, {
      source: "corpus",
      id: DISCOVERY_SKILL_ID,
    });
  });

  afterAll(() => {
    rmSync(s2root, { recursive: true, force: true });
  });

  it("exitStatus === 0 (allow)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      s2root,
    );
    expect(status).toBe(0);
  });

  it('stdout does NOT contain "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
      s2root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — user-prompt-submit with "ulw" sigil creates ward (entryPoint=full)
// ---------------------------------------------------------------------------

describe("Scenario 3 — user-prompt-submit with ulw sigil bootstraps a ward", () => {
  let s3root: string;

  beforeAll(() => {
    s3root = mkdtempSync(path.join(tmpdir(), "hima-cli-e2e-s3-"));
    // Ensure the .hima/state directory exists so ward creation can write atomically.
    mkdirSync(path.join(s3root, ".hima", "state"), { recursive: true });
  });

  afterAll(() => {
    rmSync(s3root, { recursive: true, force: true });
  });

  it("exitStatus === 0", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "build it ulw" },
      s3root,
    );
    expect(status).toBe(0);
  });

  it("stdout contains a HIMA canary in additionalContext", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "build it ulw" },
      s3root,
    );
    // The CLI must emit hookSpecificOutput.additionalContext containing [HIMA].
    expect(stdout).toMatch(/\[HIMA\]/);
    expect(stdout).toMatch(/additionalContext|hookSpecificOutput/);
  });

  it("ward.json is created at <root>/.hima/state/ward.json with entryPoint=full", async () => {
    // Spawn once more to ensure the ward file exists (idempotent create).
    spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "build it ulw" },
      s3root,
    );

    const ward = await resumeWard(s3root);
    expect(ward).not.toBeNull();
    expect(ward?.entryPoint).toBe("full");
    expect(ward?.openStage).toBe("discovery");
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — post-tool-use is a graceful no-op (exit 0, no block)
// ---------------------------------------------------------------------------

describe("Scenario 4 — post-tool-use is a graceful no-op", () => {
  it("exitStatus === 0 even when no ward exists", () => {
    // Use the shared root — even if no ward.json is present, post-tool-use must
    // never block or crash.
    const { status } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
    );
    expect(status).toBe(0);
  });

  it('stdout does NOT contain "block"', () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      { toolName: WRITE_TOOL, toolInput: {} },
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// §5 — Safety: malformed / empty stdin never crashes the CLI
// ---------------------------------------------------------------------------

describe("Safety — malformed stdin never crashes or blocks", () => {
  it("empty stdin JSON object → exit 0", () => {
    const { status } = spawnCli(["hook", "pre-tool-use", "--format", "claude"], {});
    expect(status).toBe(0);
  });

  it("invalid JSON on stdin → exit 0 (tolerated)", () => {
    // spawnCli always JSON.stringify its payload; use spawnSync directly here
    // so we can pass a deliberately malformed string that JSON.stringify cannot produce.
    const result = spawnSync(
      "node",
      [DIST_INDEX, "hook", "pre-tool-use", "--format", "claude", "--root", root],
      { input: "{{not valid json}}", encoding: "utf8", timeout: 10_000 },
    );
    expect(result.status).toBe(0);
    expect(result.stdout ?? "").not.toMatch(/"decision"\s*:\s*"block"/);
  });

  it("completely empty stdin → exit 0", () => {
    const result = spawnSync(
      "node",
      [DIST_INDEX, "hook", "session-start", "--format", "claude", "--root", root],
      { input: "", encoding: "utf8", timeout: 10_000 },
    );
    expect(result.status).toBe(0);
  });
});
