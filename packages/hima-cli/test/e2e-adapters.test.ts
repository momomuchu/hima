/**
 * e2e-adapters.test.ts — adapter integration + deferred-block roundtrip.
 *
 * Spawns the BUILT dist/index.js to validate per-runtime dispatch behavior:
 *
 * Scenario A — pre-tool-use --format codex on a skill-force condition:
 *   exit 2 AND stdout systemMessage contains the skill id within first 100 chars
 *   (R-010: translateCodex puts "[skill:<id>] <reason>" in systemMessage)
 *
 * Scenario B — pre-tool-use --format hermes on a skill-force condition:
 *   exit 2 AND stdout raw.action === "block" (R-011: Hermes ACP format)
 *
 * Scenario C — deferred-block roundtrip (hermes, R-027):
 *   1. hook stop --format hermes (floor H, DONE_VERIFIED claim, no verdicts)
 *      → exit 0 (deferred, not hard-blocking)
 *      → pending-stop-verdict-<sessionId>.json exists on disk
 *   2. hook pre-tool-use --format hermes (same sessionId)
 *      → exit 2 (deferred verdict replayed as hard-block)
 *      → verdict file is consumed and gone
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes. The test runner chains build → vitest.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard, verdictFilePath } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

/** The discovery-stage forceSkill id per DEV_CYCLE. */
const DISCOVERY_SKILL_ID = "corpus-technical-analysis-discovery";

// ---------------------------------------------------------------------------
// Spawn helper
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
// Scenario A — codex skill-force: exit 2, systemMessage carries skill id
// ---------------------------------------------------------------------------

describe("Scenario A — pre-tool-use --format codex + skill-force → exit 2 + systemMessage", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-adapters-a-"));
    // Ward at discovery with no skills loaded → skill-force will block.
    await createWard(root, { id: "adapters-e2e-a", entryPoint: "full", floor: "H" });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exit status is 2 (codex hard block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "codex"],
      { tool_name: "Write", tool_input: { path: "src/foo.ts", content: "x" } },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains decision:block", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "codex"],
      { tool_name: "Write", tool_input: { path: "src/foo.ts", content: "x" } },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("stdout systemMessage exists and contains the discovery skill id within first 100 chars", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "codex"],
      { tool_name: "Write", tool_input: { path: "src/foo.ts", content: "x" } },
      root,
    );
    const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
    const systemMessage = parsed["systemMessage"] as string | undefined;

    expect(systemMessage).toBeDefined();
    expect(typeof systemMessage).toBe("string");

    // R-010 contract: skill id must appear within first 100 chars of systemMessage.
    const prefix = (systemMessage ?? "").slice(0, 100);
    expect(prefix).toContain(DISCOVERY_SKILL_ID);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — hermes skill-force: exit 2, stdout raw.action === "block"
// ---------------------------------------------------------------------------

describe("Scenario B — pre-tool-use --format hermes + skill-force → exit 2 + raw.action:block", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-adapters-b-"));
    // Ward at discovery with no skills loaded → skill-force will block.
    await createWard(root, { id: "adapters-e2e-b", entryPoint: "full", floor: "H" });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exit status is 2 (hermes hard block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "hermes"],
      { tool_name: "Write", tool_input: { path: "src/bar.ts", content: "y" } },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains decision:block", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "hermes"],
      { tool_name: "Write", tool_input: { path: "src/bar.ts", content: "y" } },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("stdout raw.action === 'block' (Hermes ACP format)", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "hermes"],
      { tool_name: "Write", tool_input: { path: "src/bar.ts", content: "y" } },
      root,
    );
    const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
    const raw = parsed["raw"] as Record<string, unknown> | undefined;

    expect(raw).toBeDefined();
    expect(raw?.["action"]).toBe("block");
  });
});

// ---------------------------------------------------------------------------
// Scenario C — deferred roundtrip (hermes, R-027)
//
// Tests run sequentially within this describe block:
//   C1: stop exits 0 and writes the verdict file
//   C2: verify verdict file exists
//   C3: pre-tool-use replays the verdict → exit 2
//   C4: verdict file is consumed → gone
// ---------------------------------------------------------------------------

describe("Scenario C — deferred-block roundtrip (hermes, R-027)", () => {
  /** Stable session id used across all Scenario C tests. */
  const SESSION_ID = "deferred-e2e-session-01";
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-e2e-adapters-c-"));
    // Ward at H with no stage verdicts → BEH-023 will block on DONE_VERIFIED claim.
    await createWard(root, { id: "adapters-e2e-c", entryPoint: "full", floor: "H" });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("C1: stop --format hermes with DONE_VERIFIED exits 0 (deferred, not hard-blocking)", () => {
    const { status } = spawnCli(
      ["hook", "stop", "--format", "hermes"],
      { session_id: SESSION_ID, prompt: "All stages done. DONE_VERIFIED." },
      root,
    );
    // hermes stop is deferred (canBlock=false) → exit 0 even when verdict is "block".
    expect(status).toBe(0);
  });

  it("C2: pending-stop-verdict-<sessionId>.json exists after hermes stop", () => {
    // The verdict file should have been written by the stop hook in C1.
    // Run stop once more to be certain (idempotent: overwrites with same content).
    spawnCli(
      ["hook", "stop", "--format", "hermes"],
      { session_id: SESSION_ID, prompt: "Task complete. DONE_VERIFIED." },
      root,
    );
    const verdictFile = verdictFilePath(root, SESSION_ID);
    expect(existsSync(verdictFile)).toBe(true);
  });

  it("C3: pre-tool-use --format hermes (same sessionId) replays deferred block → exit 2", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "hermes"],
      { session_id: SESSION_ID, tool_name: "Write", tool_input: {} },
      root,
    );
    // Deferred verdict is consumed and replayed as a hard-block → exit 2.
    expect(status).toBe(2);
  });

  it("C4: verdict file is consumed/gone after deferred replay", () => {
    // The pre-tool-use handler (C3) consumed the verdict file (single-use).
    const verdictFile = verdictFilePath(root, SESSION_ID);
    expect(existsSync(verdictFile)).toBe(false);
  });
});
