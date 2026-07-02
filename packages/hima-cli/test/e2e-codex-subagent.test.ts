/**
 * e2e-codex-subagent.test.ts — SPAWN proof for R-049 (codex-subagent wiring).
 *
 * Before this wiring, codex-subagent.ts (registerSubagent/readSubagentRegistry)
 * had zero call sites in router.ts: `grep -rn 'registerSubagent|readSubagentRegistry'
 * packages --include='*.ts' | grep -v test.ts` returned only the re-export line
 * in hima-core/src/index.ts. handlePreToolUse had no Codex-specific branch, so
 * the poll-file compensation mechanism could never fire in production.
 *
 * This suite proves the registry is populated on a live codex subagent-spawn
 * pre-tool-use event (analogous to e2e-subagents.test.ts Scenario C, but for
 * Codex's poll-file compensation rather than Hermes's delegate_task intercept).
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

const PARENT_SESSION_ID = "codex-parent-session-1";

// ---------------------------------------------------------------------------
// Spawn helper
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, "hook", ...args, "--root", cliRoot], {
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

function pollFilePath(root: string, parentSessionId: string): string {
  return path.join(root, ".hima", "state", `subagent-poll-${parentSessionId}.json`);
}

// ---------------------------------------------------------------------------
// Tmp root lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-e2e-codex-subagent-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Scenario — codex pre-tool-use "Task" spawn → poll file populated
// ---------------------------------------------------------------------------

describe("R-049 — codex subagent spawn populates the poll-file registry", () => {
  it("pre-tool-use --format codex with toolName Task → exit 0 (non-blocking)", () => {
    const { status } = spawnCli(
      ["pre-tool-use", "--format", "codex"],
      {
        session_id: PARENT_SESSION_ID,
        tool_name: "Task",
        tool_input: { childSessionId: "child-session-A", prompt: "do work" },
      },
      root,
    );
    expect(status).toBe(0);
  });

  it("the poll file for the parent session is created and contains the child id", async () => {
    const raw = await readFile(pollFilePath(root, PARENT_SESSION_ID), "utf8");
    const registry = JSON.parse(raw) as string[];
    expect(registry).toContain("child-session-A");
  });

  it("a second spawn with a different child id appends (does not overwrite)", async () => {
    const { status } = spawnCli(
      ["pre-tool-use", "--format", "codex"],
      {
        session_id: PARENT_SESSION_ID,
        tool_name: "subagent_spawn",
        tool_input: { child_session_id: "child-session-B" },
      },
      root,
    );
    expect(status).toBe(0);

    const raw = await readFile(pollFilePath(root, PARENT_SESSION_ID), "utf8");
    const registry = JSON.parse(raw) as string[];
    expect(registry).toEqual(["child-session-A", "child-session-B"]);
  });

  it("non-codex runtimes do NOT populate the poll file for a fresh session", () => {
    const { status } = spawnCli(
      ["pre-tool-use", "--format", "claude"],
      {
        session_id: "claude-parent-session",
        tool_name: "Task",
        tool_input: { childSessionId: "child-session-claude" },
      },
      root,
    );
    // Claude's own subagent gate (BEH_WORKER_MODEL / skill-force) governs the
    // exit code here; the point under test is the poll-file side effect below.
    expect(status === 0 || status === 2).toBe(true);
  });

  it("no poll file exists for the claude-runtime parent session", async () => {
    await expect(
      readFile(pollFilePath(root, "claude-parent-session"), "utf8"),
    ).rejects.toThrow();
  });
});
