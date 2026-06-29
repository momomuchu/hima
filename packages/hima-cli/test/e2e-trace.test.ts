/**
 * e2e-trace.test.ts — integration test for @hima/cli observability pipeline.
 *
 * Proves the full trace-emission → trace-viewer cycle:
 *   1. user-prompt-submit with "ulw" sigil → exit 0, trace line written.
 *   2. pre-tool-use Write (ward at discovery, skill absent) → exit 2 (block),
 *      trace line written.
 *   3. <root>/.hima/state/trace/s1.jsonl exists with ≥2 lines.
 *   4. `hima trace --session s1 --root <root>` → exit 0, stdout contains
 *      a "block" line in the timeline.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes (dist/index.js must exist).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

const SESSION_ID = "s1";

// ---------------------------------------------------------------------------
// Tmp root lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-trace-e2e-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: spawn dist/index.js with a JSON stdin payload
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload?: Record<string, unknown>,
): { status: number | null; stdout: string; stderr: string } {
  const input = stdinPayload !== undefined ? JSON.stringify(stdinPayload) : "";
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", root], {
    input,
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
// The three-phase trace integration test
// ---------------------------------------------------------------------------

describe("e2e-trace — full observability pipeline", () => {
  // Phase 1: user-prompt-submit with "ulw" sigil creates a ward and a trace line
  it("Phase 1: user-prompt-submit with ulw sigil → exit 0", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { session_id: SESSION_ID, prompt: "build it ulw" },
    );
    expect(status).toBe(0);
  });

  // Phase 2: pre-tool-use Write with discovery skill absent → exit 2 (block)
  it("Phase 2: pre-tool-use Write (skill absent) → exit 2 block", () => {
    const { status, stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { session_id: SESSION_ID, tool_name: "Write" },
    );
    expect(status).toBe(2);
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  // Phase 3: trace file exists with ≥2 lines
  it("Phase 3: trace file has ≥2 JSONL lines", () => {
    const traceFile = path.join(root, ".hima", "state", "trace", `${SESSION_ID}.jsonl`);
    let content: string;
    try {
      content = readFileSync(traceFile, "utf8");
    } catch {
      throw new Error(`Trace file not found at: ${traceFile}`);
    }

    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Each line must be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  // Phase 4: hima trace command renders the session timeline with a block line
  it("Phase 4: hima trace --session s1 → exit 0, stdout has block line", () => {
    const { status, stdout } = spawnCli(
      ["trace", "--session", SESSION_ID],
    );
    expect(status).toBe(0);
    // Timeline must contain a "-> block" entry for the pre-tool-use event
    expect(stdout).toContain("-> block");
    // Summary must show total events
    expect(stdout).toMatch(/total:\d+/);
  });

  // Bonus: --json flag returns valid JSON array
  it("Bonus: hima trace --session s1 --json → valid JSON array", () => {
    const { status, stdout } = spawnCli(
      ["trace", "--session", SESSION_ID, "--json"],
    );
    expect(status).toBe(0);
    let parsed: unknown;
    expect(() => { parsed = JSON.parse(stdout); }).not.toThrow();
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  // Bonus: --only-blocks flag shows only the block event
  it("Bonus: hima trace --session s1 --only-blocks → timeline has only block lines", () => {
    const { status, stdout } = spawnCli(
      ["trace", "--session", SESSION_ID, "--only-blocks"],
    );
    expect(status).toBe(0);
    // All timeline lines with an arrow must be blocks
    const arrowLines = stdout.split("\n").filter((l) => l.includes("->"));
    expect(arrowLines.length).toBeGreaterThanOrEqual(1);
    expect(arrowLines.every((l) => l.includes("-> block"))).toBe(true);
  });

  // Alias: hima observe works the same as hima trace
  it("Alias: hima observe --session s1 → same output as trace", { timeout: 30_000 }, () => {
    const traceResult = spawnCli(["trace", "--session", SESSION_ID]);
    const observeResult = spawnCli(["observe", "--session", SESSION_ID]);
    expect(observeResult.status).toBe(0);
    expect(observeResult.stdout).toBe(traceResult.stdout);
  });
});

// ---------------------------------------------------------------------------
// Safety: hima trace with unknown session → graceful exit
// ---------------------------------------------------------------------------

describe("e2e-trace — safety cases", () => {
  it("hima trace --session nonexistent → exit 0, shows no trace events", () => {
    const { status, stdout } = spawnCli(
      ["trace", "--session", "nonexistent-session-xyz"],
    );
    // readTrace returns [] for missing file → renderObserve outputs "no trace events"
    expect(status).toBe(0);
    expect(stdout).toContain("no trace events");
  });

  it("hima trace with no --session and no trace files → exit 1 with helpful message", () => {
    // Use a fresh empty root to avoid picking up the shared session
    const emptyRoot = mkdtempSync(path.join(tmpdir(), "hima-trace-empty-"));
    try {
      const result = spawnSync(
        "node",
        [DIST_INDEX, "trace", "--root", emptyRoot],
        { input: "", encoding: "utf8", timeout: 10_000 },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("no trace files");
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
